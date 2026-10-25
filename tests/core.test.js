import test from "node:test";
import assert from "node:assert/strict";
import { grade, nextDifficulty, subjects } from "../shared/syllabus.js";
import { publicQuestion, questionSchema, chartSvg } from "../server/core.js";
const q = {
  type: "MCQ",
  prompt: "Which of these values is equal to 2 + 2?",
  options: ["1", "2", "3", "4"],
  correctOptions: [3],
  numericMin: 0,
  numericMax: 0,
  explanation: "Adding two and two gives four. The other values are incorrect.",
  hint: "Count two pairs.",
  difficultyReason: "Single arithmetic operation.",
  diagram: null,
};
test("MCQ and MSQ require exactly the correct option set", () => {
  assert.equal(grade(q, [3]), true);
  assert.equal(grade(q, [1]), false);
  assert.equal(
    grade({ ...q, type: "MSQ", correctOptions: [0, 2] }, [2, 0]),
    true,
  );
  assert.equal(
    grade({ ...q, type: "MSQ", correctOptions: [0, 2] }, [0]),
    false,
  );
  assert.equal(
    grade({ ...q, type: "MSQ", correctOptions: [0, 2] }, [0, 2, 3]),
    false,
  );
});
test("NAT accepts range boundaries and rejects empty or invalid values", () => {
  const n = { type: "NAT", numericMin: 0.32, numericMax: 0.34 };
  for (const v of [".32", ".33", ".34"]) assert.equal(grade(n, v), true);
  for (const v of ["", " ", "oops", ".35", "Infinity"])
    assert.equal(grade(n, v), false);
});
test("adaptive difficulty stays within bounds and respects manual mode", () => {
  assert.equal(nextDifficulty(3, true, true), 3);
  assert.equal(nextDifficulty(1, false, true), 1);
  assert.equal(nextDifficulty(1, true, true), 2);
  assert.equal(nextDifficulty(3, false, true), 2);
  assert.equal(nextDifficulty(2, true, false), 2);
});
test("unsubmitted questions never disclose solutions", () => {
  const safe = publicQuestion({ ...q, id: "test", studentId: "private" });
  for (const key of [
    "correctOptions",
    "numericMin",
    "numericMax",
    "explanation",
    "difficultyReason",
    "studentId",
  ])
    assert.equal(key in safe, false);
});
test("question validation rejects inconsistent answer structures", () => {
  assert.equal(questionSchema.safeParse(q).success, true);
  assert.equal(
    questionSchema.safeParse({ ...q, correctOptions: [0, 1] }).success,
    false,
  );
  assert.equal(
    questionSchema.safeParse({ ...q, type: "MSQ", correctOptions: [0] })
      .success,
    false,
  );
  assert.equal(
    questionSchema.safeParse({
      ...q,
      type: "NAT",
      options: [],
      correctOptions: [],
      numericMin: 2,
      numericMax: 1,
    }).success,
    false,
  );
});
test("diagram labels are escaped and never executable", () => {
  const svg = chartSvg({
    title: "<script>alert(1)</script>",
    labels: ["<img/>", "b"],
    values: [1, 2],
  });
  assert.ok(!svg.includes("<script>"));
  assert.ok(svg.includes("&lt;script&gt;"));
});
test("all seven DA subjects have unique topic groups", () => {
  assert.equal(subjects.length, 7);
  for (const s of subjects) {
    assert.ok(s.topics.length);
    assert.equal(new Set(s.topics).size, s.topics.length);
  }
});

test("Gemini retries temporary failures and validates the returned question", async () => {
  const { generate } = await import("../server/services.js");
  const originalFetch = globalThis.fetch;
  const oldKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-only-key";
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return calls === 1
      ? new Response("{}", { status: 503 })
      : new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: JSON.stringify(q) }] } }],
          }),
          { status: 200 },
        );
  };
  try {
    const generated = await generate({
      subject: "Probability",
      topic: "Counting",
      difficulty: 1,
      type: "MCQ",
      previous: [],
    });
    assert.equal(generated.type, "MCQ");
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
  }
});
