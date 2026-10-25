// Opt-in integration check. Creates a clearly named test profile and one saved question.
import assert from "node:assert/strict";
const base = process.env.HER_TEST_URL || "http://127.0.0.1:5174";
async function post(action, data, token) {
  const response = await fetch(`${base}/api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action, ...data }),
    signal: AbortSignal.timeout(110000),
  });
  const result = await response.json();
  assert.ok(response.ok, `${action}: ${result.error}`);
  return result;
}
const profile = await post("register", { name: "Integration Check" });
console.log("Profile registration: passed");
const { question } = await post(
  "generate",
  {
    subject: "probability",
    topic: "Bayes theorem",
    difficulty: 1,
    type: "MCQ",
  },
  profile.token,
);
assert.equal("correctOptions" in question, false);
assert.equal("explanation" in question, false);
console.log("Live generation, MongoDB save and solution redaction: passed");
const first = await post(
  "answer",
  { questionId: question.id, answer: [0] },
  profile.token,
);
assert.ok(first.solution.explanation);
const second = await post(
  "answer",
  { questionId: question.id, answer: [1] },
  profile.token,
);
assert.equal(first.attempt.id, second.attempt.id);
console.log("Answer explanation and first submission preservation: passed");
const history = await fetch(`${base}/api?action=history`, {
  headers: { Authorization: `Bearer ${profile.token}` },
}).then((r) => r.json());
assert.equal(history.items[0].attempt.id, first.attempt.id);
console.log("Saved history: passed");
const unauthorized = await fetch(`${base}/api?action=history`);
assert.equal(unauthorized.status, 401);
const stranger = await post("register", { name: "Isolation Check" });
const denied = await fetch(`${base}/api`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${stranger.token}`,
  },
  body: JSON.stringify({
    action: "answer",
    questionId: question.id,
    answer: [0],
  }),
});
assert.equal(denied.status, 404);
console.log("Unauthenticated access and cross-student access blocked: passed");
