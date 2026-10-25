import { MongoClient } from "mongodb";
import { questionSchema, chartSvg, AppError } from "./core.js";
let dbPromise;
let driveToken;
export async function db() {
  if (!process.env.MONGODB_URI)
    throw new AppError(
      503,
      "MongoDB is not configured. Add MONGODB_URI to the server environment.",
    );
  if (!dbPromise) {
    dbPromise = (async () => {
      const client = new MongoClient(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 8000,
        maxPoolSize: 5,
      });
      await client.connect();
      const d = client.db(process.env.MONGODB_DB || "her_gate");
      await Promise.all([
        d
          .collection("students")
          .createIndex({ tokenHash: 1 }, { unique: true }),
        d.collection("questions").createIndex({ studentId: 1, createdAt: -1 }),
        d.collection("attempts").createIndex({ studentId: 1, createdAt: -1 }),
        d
          .collection("attempts")
          .createIndex({ studentId: 1, questionId: 1 }, { unique: true }),
      ]);
      return d;
    })().catch((e) => {
      dbPromise = undefined;
      throw e;
    });
  }
  return dbPromise;
}
export function driveEnabled() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN,
  );
}
export async function accessToken() {
  if (driveToken && driveToken.expires > Date.now()) return driveToken.value;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok)
    throw new AppError(
      502,
      "Google Drive authorization failed. Check the server OAuth credentials.",
    );
  const data = await r.json();
  driveToken = {
    value: data.access_token,
    expires: Date.now() + (data.expires_in - 120) * 1000,
  };
  return driveToken.value;
}
export async function uploadChart(diagram, id) {
  const token = await accessToken();
  const name = `her-${id}.svg`;
  const metadata = {
    name,
    mimeType: "image/svg+xml",
    parents: [
      process.env.GOOGLE_DRIVE_FOLDER_ID || "1EayeTjOFadwr6ywyZPzMiGIZMJ4HEmhc",
    ],
  };
  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" }),
  );
  form.append(
    "file",
    new Blob([chartSvg(diagram)], { type: "image/svg+xml" }),
    name,
  );
  const r = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!r.ok)
    throw new AppError(
      502,
      "Could not save the question diagram to Drive. Check folder access and OAuth scope.",
    );
  const f = await r.json();
  return {
    id: f.id,
    name: f.name,
    url: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
  };
}
const responseSchema = {
  type: "OBJECT",
  properties: {
    type: { type: "STRING", enum: ["MCQ", "MSQ", "NAT"] },
    prompt: { type: "STRING" },
    options: { type: "ARRAY", items: { type: "STRING" } },
    correctOptions: { type: "ARRAY", items: { type: "INTEGER" } },
    numericMin: { type: "NUMBER" },
    numericMax: { type: "NUMBER" },
    explanation: { type: "STRING" },
    hint: { type: "STRING" },
    difficultyReason: { type: "STRING" },
    diagram: {
      type: "OBJECT",
      nullable: true,
      properties: {
        title: { type: "STRING" },
        labels: { type: "ARRAY", items: { type: "STRING" } },
        values: { type: "ARRAY", items: { type: "NUMBER" } },
      },
      required: ["title", "labels", "values"],
    },
  },
  required: [
    "type",
    "prompt",
    "options",
    "correctOptions",
    "numericMin",
    "numericMax",
    "explanation",
    "hint",
    "difficultyReason",
    "diagram",
  ],
};
async function fetchGemini(url, options) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(30000),
      });
      if (attempt === 0 && [500, 502, 503, 504].includes(response.status)) {
        await response.body?.cancel();
        continue;
      }
      return response;
    } catch (error) {
      if (
        attempt === 1 ||
        !["TimeoutError", "AbortError", "TypeError"].includes(error.name)
      )
        throw error;
    }
  }
}
export async function generate({ subject, topic, difficulty, type, previous }) {
  if (!process.env.GEMINI_API_KEY)
    throw new AppError(
      503,
      "Gemini is not configured. Add GEMINI_API_KEY to the server environment.",
    );
  const prompt = `You are a careful GATE DA practice question author. Generate ONE original, mathematically valid GATE-style question. This is practice, never claim it is an official past-paper question. Subject: ${subject}. Exact syllabus topic: ${topic}. Difficulty: ${["", "Low (foundational, one concept)", "Medium (application, two steps)", "High (multi-step reasoning)"][difficulty]}. Type: ${type === "MIXED" ? "Choose MCQ, MSQ or NAT" : type}. MCQ has exactly four distinct options and one correct zero-based index. MSQ has exactly four distinct options and at least two correct indices. NAT has empty options and correctOptions, with numericMin and numericMax defining an explicit narrow accepted range; specify rounding in prompt when needed. For non-NAT numericMin and numericMax are 0. Explain the solution step by step, justify the result, and explain relevant distractors. Independently solve and verify before returning. Use readable plain text with Unicode mathematics, no Markdown or LaTeX. Include a short non-revealing hint and difficultyReason. ${driveEnabled() ? "A simple labelled bar chart is allowed only when it materially helps; include positive values and equally sized labels/values (2–8). All information needed to solve must also appear in prompt. Otherwise diagram=null." : "Use self-contained text questions only. diagram must be null."} Avoid repeating these recent questions: ${JSON.stringify(previous).slice(0, 5000)}. Return JSON matching schema.`;
  const r = await fetchGemini(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL || "gemini-3.5-flash-lite")}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 1,
          maxOutputTokens: 6000,
          ...(String(
            process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
          ).startsWith("gemini-3")
            ? { thinkingConfig: { thinkingLevel: "low" } }
            : {}),
        },
      }),
    },
  );
  if (!r.ok)
    throw new AppError(
      502,
      `Gemini could not generate a question (HTTP ${r.status}). Check the API key, model access and quota.`,
    );
  const data = await r.json();
  const raw = data.candidates?.[0]?.content?.parts
    ?.filter((p) => !p.thought)
    .map((p) => p.text || "")
    .join("");
  let parsed;
  try {
    parsed = questionSchema.parse(JSON.parse(raw));
  } catch {
    throw new AppError(
      502,
      "Gemini returned an invalid question. Please try again.",
    );
  }
  if (type !== "MIXED" && parsed.type !== type)
    throw new AppError(
      502,
      "Gemini returned the wrong question format. Please try again.",
    );
  if (!driveEnabled() && parsed.diagram)
    throw new AppError(
      502,
      "Gemini returned an unsupported diagram. Please try again.",
    );
  return parsed;
}
