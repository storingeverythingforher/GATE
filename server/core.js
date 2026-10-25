import { z } from "zod";
export const questionSchema = z
  .object({
    type: z.enum(["MCQ", "MSQ", "NAT"]),
    prompt: z.string().min(15).max(6000),
    options: z.array(z.string().min(1).max(2000)).max(4),
    correctOptions: z.array(z.number().int().min(0).max(3)).max(4),
    numericMin: z.number().finite(),
    numericMax: z.number().finite(),
    explanation: z.string().min(20).max(12000),
    hint: z.string().max(1000),
    difficultyReason: z.string().min(5).max(1000),
    diagram: z
      .object({
        title: z.string().max(100),
        labels: z.array(z.string().max(30)).min(2).max(8),
        values: z.array(z.number().nonnegative().finite()).min(2).max(8),
      })
      .nullable(),
  })
  .superRefine((q, ctx) => {
    const invalid =
      q.type === "NAT"
        ? q.options.length !== 0 ||
          q.correctOptions.length !== 0 ||
          q.numericMin > q.numericMax
        : q.options.length !== 4 ||
          new Set(q.options).size !== 4 ||
          new Set(q.correctOptions).size !== q.correctOptions.length ||
          (q.type === "MCQ"
            ? q.correctOptions.length !== 1
            : q.correctOptions.length < 2);
    if (invalid)
      ctx.addIssue({
        code: "custom",
        message: "Invalid question answer structure",
      });
    if (
      q.diagram &&
      (q.diagram.labels.length !== q.diagram.values.length ||
        Math.max(...q.diagram.values) <= 0)
    )
      ctx.addIssue({ code: "custom", message: "Invalid chart" });
  });
export function publicQuestion(q) {
  return Object.fromEntries(
    [
      "id",
      "subject",
      "topic",
      "difficulty",
      "type",
      "prompt",
      "options",
      "hint",
      "image",
      "createdAt",
    ].map((k) => [k, q[k]]),
  );
}
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
export function chartSvg(d) {
  const max = Math.max(...d.values, 1);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="330" viewBox="0 0 640 330"><rect width="640" height="330" fill="#f5f8f4"/><text x="30" y="35" font-size="18" font-family="sans-serif">${esc(d.title)}</text>${d.values
    .map((v, i) => {
      const w = 540 / d.values.length,
        x = 55 + i * w,
        h = (v / max) * 190;
      return `<rect x="${x}" y="${255 - h}" width="${w - 14}" height="${h}" rx="4" fill="#277460"/><text x="${x}" y="${245 - h}" font-family="sans-serif" font-size="13">${esc(v)}</text><text x="${x}" y="280" font-family="sans-serif" font-size="12">${esc(d.labels[i])}</text>`;
    })
    .join("")}</svg>`;
}
export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
