import { randomBytes, randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import {
  db,
  generate,
  uploadChart,
  driveEnabled,
  accessToken,
} from "../server/services.js";
import { AppError, publicQuestion } from "../server/core.js";
import { subjects, grade } from "../shared/syllabus.js";
const hash = (s) => createHash("sha256").update(s).digest("hex");
async function readBody(req) {
  if (req.body)
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  let raw = "";
  for await (const part of req) {
    raw += part;
    if (raw.length > 16000) throw new AppError(413, "Request is too large.");
  }
  try {
    return JSON.parse(raw || "{}");
  } catch {
    throw new AppError(400, "Invalid JSON.");
  }
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  const send = (data, status = 200) => {
    res.statusCode = status;
    res.end(JSON.stringify(data));
  };
  try {
    if (!["GET", "POST"].includes(req.method))
      throw new AppError(405, "Method not allowed.");
    const url = new URL(req.url, "http://localhost");
    const body = req.method === "POST" ? await readBody(req) : {};
    const action =
      req.method === "GET" ? url.searchParams.get("action") : body.action;
    if (action === "status") {
      return send({
        gemini: Boolean(process.env.GEMINI_API_KEY),
        mongo: Boolean(process.env.MONGODB_URI),
        drive: driveEnabled(),
      });
    }
    const d = await db();
    if (action === "register" && req.method === "POST") {
      const name = z.string().trim().min(1).max(60).parse(body.name);
      const ip = String(
        req.headers["x-forwarded-for"] ||
          req.socket?.remoteAddress ||
          "unknown",
      ).split(",")[0];
      const ipHash = hash(ip);
      const recent = await d.collection("students").countDocuments({
        ipHash,
        createdAt: { $gte: new Date(Date.now() - 3600000) },
      });
      if (recent >= 20)
        throw new AppError(
          429,
          "Too many new profiles. Please try again in an hour.",
        );
      const token = randomBytes(32).toString("hex");
      const student = {
        id: randomUUID(),
        name,
        tokenHash: hash(token),
        ipHash,
        createdAt: new Date(),
      };
      await d.collection("students").insertOne(student);
      return send({ token, student: { id: student.id, name } });
    }
    const token = String(req.headers.authorization || "").replace(
      /^Bearer /,
      "",
    );
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new AppError(401, "Please create or restore your student profile.");
    const student = await d
      .collection("students")
      .findOne({ tokenHash: hash(token) });
    if (!student)
      throw new AppError(
        401,
        "Your profile could not be found. Please start a new profile.",
      );
    if (action === "history" && req.method === "GET") {
      const [questions, attempts] = await Promise.all([
        d
          .collection("questions")
          .find({ studentId: student.id }, { projection: { _id: 0 } })
          .sort({ createdAt: -1 })
          .limit(200)
          .toArray(),
        d
          .collection("attempts")
          .find({ studentId: student.id }, { projection: { _id: 0 } })
          .sort({ createdAt: -1 })
          .limit(200)
          .toArray(),
      ]);
      const mapped = questions.map((q) => {
        const a = attempts.find((a) => a.questionId === q.id);
        return {
          question: a
            ? {
                ...publicQuestion(q),
                correctOptions: q.correctOptions,
                numericMin: q.numericMin,
                numericMax: q.numericMax,
                explanation: q.explanation,
                difficultyReason: q.difficultyReason,
              }
            : publicQuestion(q),
          attempt: a || null,
        };
      });
      return send({
        student: { id: student.id, name: student.name },
        items: mapped,
      });
    }
    if (action === "generate" && req.method === "POST") {
      const input = z
        .object({
          subject: z.string(),
          topic: z.string(),
          difficulty: z.number().int().min(1).max(3),
          type: z.enum(["MCQ", "MSQ", "NAT", "MIXED"]),
        })
        .parse(body);
      const subject = subjects.find((s) => s.id === input.subject);
      if (!subject || !subject.topics.includes(input.topic))
        throw new AppError(400, "Choose a valid syllabus topic.");
      const recent = await d.collection("questions").countDocuments({
        studentId: student.id,
        createdAt: { $gte: new Date(Date.now() - 60000) },
      });
      if (recent >= 8)
        throw new AppError(
          429,
          "Please wait a minute before generating more questions.",
        );
      const lock = await d.collection("students").findOneAndUpdate(
        {
          id: student.id,
          $or: [
            { generatingUntil: { $exists: false } },
            { generatingUntil: { $lt: new Date() } },
          ],
        },
        { $set: { generatingUntil: new Date(Date.now() + 110000) } },
        { returnDocument: "after" },
      );
      if (!lock)
        throw new AppError(
          429,
          "A question is already being prepared. Please wait.",
        );
      try {
        const previous = await d
          .collection("questions")
          .find({ studentId: student.id, topic: input.topic })
          .sort({ createdAt: -1 })
          .limit(8)
          .project({ prompt: 1 })
          .toArray();
        const generated = await generate({
          ...input,
          subject: subject.name,
          previous: previous.map((q) => q.prompt),
        });
        const id = randomUUID();
        const image = generated.diagram
          ? await uploadChart(generated.diagram, id)
          : null;
        const question = {
          ...generated,
          id,
          studentId: student.id,
          subject: input.subject,
          topic: input.topic,
          difficulty: input.difficulty,
          image,
          createdAt: new Date(),
        };
        delete question.diagram;
        await d.collection("questions").insertOne(question);
        return send({ question: publicQuestion(question) });
      } finally {
        await d
          .collection("students")
          .updateOne({ id: student.id }, { $unset: { generatingUntil: "" } });
      }
    }
    if (action === "answer" && req.method === "POST") {
      const id = z.string().uuid().parse(body.questionId);
      const q = await d
        .collection("questions")
        .findOne({ id, studentId: student.id });
      if (!q) throw new AppError(404, "Question not found.");
      const answer =
        q.type === "NAT"
          ? z
              .string()
              .trim()
              .min(1)
              .max(80)
              .refine((v) => Number.isFinite(Number(v)))
              .parse(body.answer)
          : z
              .array(z.number().int().min(0).max(3))
              .min(1)
              .max(4)
              .refine(
                (v) =>
                  new Set(v).size === v.length &&
                  (q.type !== "MCQ" || v.length === 1),
              )
              .parse(body.answer);
      const attempt = {
        id: randomUUID(),
        studentId: student.id,
        questionId: id,
        answer,
        correct: grade(q, answer),
        createdAt: new Date(),
      };
      await d
        .collection("attempts")
        .updateOne(
          { studentId: student.id, questionId: id },
          { $setOnInsert: attempt },
          { upsert: true },
        );
      const saved = await d
        .collection("attempts")
        .findOne(
          { studentId: student.id, questionId: id },
          { projection: { _id: 0 } },
        );
      return send({
        attempt: saved,
        solution: {
          correctOptions: q.correctOptions,
          numericMin: q.numericMin,
          numericMax: q.numericMax,
          explanation: q.explanation,
          difficultyReason: q.difficultyReason,
        },
      });
    }
    if (action === "image" && req.method === "GET") {
      const q = await d
        .collection("questions")
        .findOne({ id: url.searchParams.get("id"), studentId: student.id });
      if (!q?.image) throw new AppError(404, "Image not found.");
      const r = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(q.image.id)}?alt=media`,
        {
          headers: { Authorization: `Bearer ${await accessToken()}` },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!r.ok) throw new AppError(502, "Could not load the stored diagram.");
      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      );
      res.end(await r.text());
      return;
    }
    throw new AppError(404, "Unknown action.");
  } catch (e) {
    if (e instanceof z.ZodError)
      return send(
        { error: "Please check your selections and try again." },
        400,
      );
    if (e instanceof AppError) return send({ error: e.message }, e.status);
    if (e.name === "TimeoutError" || e.name === "AbortError")
      return send(
        { error: "The service took too long to respond. Please try again." },
        504,
      );
    console.error("API failure:", e.name, e.code || "");
    return send(
      {
        error:
          "Unable to reach the database. Check your MongoDB credentials and Atlas network access.",
      },
      503,
    );
  }
}
