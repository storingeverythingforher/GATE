import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  History,
  LayoutDashboard,
  Check,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Target,
  Flame,
  CheckCircle2,
  XCircle,
  LoaderCircle,
  RotateCcw,
  Menu,
  X,
  ExternalLink,
  Lightbulb,
  GraduationCap,
  LogOut,
} from "lucide-react";
import {
  subjects,
  levels,
  nextDifficulty,
  syllabusUrl,
} from "../shared/syllabus";
import "./styles.css";
const store = {
  get(k, f) {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? f;
    } catch {
      return f;
    }
  },
  set(k, v) {
    localStorage.setItem(k, JSON.stringify(v));
  },
};
async function request(action, data, token) {
  const r = await fetch(data === undefined ? `/api?action=${action}` : "/api", {
    method: data === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(data !== undefined
      ? { body: JSON.stringify({ action, ...data }) }
      : {}),
  });
  const value = await r.json();
  if (!r.ok)
    throw new Error(value.error || "Something went wrong. Please try again.");
  return value;
}
function App() {
  const [profile, setProfile] = useState(() => store.get("her-profile", null));
  const [savedProfiles, setSavedProfiles] = useState(() => {
    const saved = store.get("her-profiles", []);
    const profiles = Array.isArray(saved)
      ? saved.filter((p) => p?.id && p?.name && p?.token)
      : [];
    const current = store.get("her-profile", null);
    if (current?.token && !profiles.some((p) => p.id === current.id))
      profiles.push(current);
    return profiles;
  });
  const activeToken = useRef(profile?.token);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [name, setName] = useState("");
  const [page, setPage] = useState("practice");
  const [subjectId, setSubjectId] = useState("probability");
  const [topic, setTopic] = useState(subjects[0].topics[0]);
  const [difficulty, setDifficulty] = useState(1);
  const [progressive, setProgressive] = useState(false);
  const [type, setType] = useState("MIXED");
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState([]);
  const [result, setResult] = useState(null);
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [hint, setHint] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [status, setStatus] = useState(null);
  const [image, setImage] = useState(null);
  const [review, setReview] = useState(false);
  const subject = subjects.find((s) => s.id === subjectId);
  const attempts = items.filter((i) => i.attempt);
  const correct = attempts.filter((i) => i.attempt.correct).length;
  const accuracy = attempts.length
    ? Math.round((correct / attempts.length) * 100)
    : 0;
  const mastered = new Set(
    attempts.filter((i) => i.attempt.correct).map((i) => i.question.topic),
  ).size;
  const count = subjects.reduce((n, s) => n + s.topics.length, 0);
  useEffect(() => {
    request("status")
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);
  useEffect(() => {
    store.set("her-profiles", savedProfiles);
  }, [savedProfiles]);
  useEffect(() => {
    if (profile) loadHistory();
  }, [profile?.token]);
  useEffect(() => {
    let active = true;
    let objectUrl;
    if (question?.image && profile) {
      fetch(`/api?action=image&id=${question.id}`, {
        headers: { Authorization: `Bearer ${profile.token}` },
      })
        .then((r) => {
          if (!r.ok) throw Error();
          return r.blob();
        })
        .then((b) => {
          objectUrl = URL.createObjectURL(b);
          if (active) setImage(objectUrl);
        })
        .catch(() => {
          if (active)
            setError(
              "The diagram could not load. All required data is included in the question text.",
            );
        });
    } else setImage(null);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setImage(null);
    };
  }, [question?.id]);
  async function loadHistory() {
    const token = profile?.token;
    if (!token) return;
    try {
      const d = await request("history", undefined, token);
      if (activeToken.current === token) setItems(d.items);
    } catch (e) {
      if (activeToken.current === token) setError(e.message);
    }
  }
  function switchProfile(nextProfile) {
    if (busy) return;
    activeToken.current = nextProfile?.token;
    store.set("her-profile", nextProfile);
    setProfile(nextProfile);
    setItems([]);
    setQuestion(null);
    setResult(null);
    setAnswer([]);
    setHint(false);
    setImage(null);
    setReview(false);
    setError("");
    setPage("practice");
    setFilter("all");
    setMobile(false);
    setName("");
    setCreatingProfile(false);
    setSubjectId(subjects[0].id);
    setTopic(subjects[0].topics[0]);
    setDifficulty(1);
    setProgressive(false);
    setType("MIXED");
  }
  function chooseSubject(id) {
    setSubjectId(id);
    setTopic(subjects.find((s) => s.id === id).topics[0]);
  }
  function navigate(p) {
    setPage(p);
    setMobile(false);
    setError("");
  }
  async function register(e) {
    e.preventDefault();
    setBusy("profile");
    setError("");
    try {
      const d = await request("register", { name: name.trim() });
      const p = { ...d.student, token: d.token };
      setSavedProfiles((previous) => [
        ...previous.filter((existing) => existing.id !== p.id),
        p,
      ]);
      activeToken.current = p.token;
      store.set("her-profile", p);
      setProfile(p);
      setName("");
      setCreatingProfile(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function generateQuestion() {
    if (!profile) {
      document.querySelector("#student-name")?.focus();
      return;
    }
    setBusy("generate");
    setError("");
    try {
      const d = await request(
        "generate",
        { subject: subjectId, topic, difficulty, type },
        profile.token,
      );
      setQuestion(d.question);
      setAnswer(d.question.type === "NAT" ? "" : []);
      setResult(null);
      setHint(false);
      setReview(false);
      setPage("practice");
      setItems((prev) =>
        [{ question: d.question, attempt: null }, ...prev].slice(0, 200),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function submit() {
    setBusy("answer");
    setError("");
    try {
      const d = await request(
        "answer",
        { questionId: question.id, answer },
        profile.token,
      );
      setResult(d);
      setItems((prev) =>
        prev.map((i) =>
          i.question.id === question.id
            ? { question: { ...question, ...d.solution }, attempt: d.attempt }
            : i,
        ),
      );
      setDifficulty((v) => nextDifficulty(v, d.attempt.correct, progressive));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  function openItem(item) {
    const q = item.question;
    setSubjectId(q.subject);
    setTopic(q.topic);
    setQuestion(q);
    setDifficulty(q.difficulty);
    setAnswer(item.attempt?.answer ?? (q.type === "NAT" ? "" : []));
    setResult(item.attempt ? { attempt: item.attempt, solution: q } : null);
    setReview(Boolean(item.attempt));
    setHint(false);
    navigate("practice");
  }
  function selectOption(i) {
    if (result || busy) return;
    setAnswer((v) =>
      question.type === "MCQ"
        ? [i]
        : v.includes(i)
          ? v.filter((x) => x !== i)
          : [...v, i],
    );
  }
  const validAnswer =
    question?.type === "NAT"
      ? String(answer).trim() !== "" && Number.isFinite(Number(answer))
      : Array.isArray(answer) && answer.length > 0;
  return (
    <div className="app">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("practice");
          }}
        >
          <span className="brand-mark">
            h<span>✳</span>
          </span>
          her<span className="brand-dot">.</span>
        </a>
        <button
          className="mobile-close icon-button"
          onClick={() => setMobile(false)}
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
        <div className="workspace-label">YOUR STUDY SPACE</div>
        <nav>
          {[
            ["practice", LayoutDashboard, "Practice room"],
            ["history", History, "Question history"],
            ["syllabus", BookOpen, "Your syllabus"],
          ].map(([id, Icon, label]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              {label}
              {id === "history" && attempts.some((i) => !i.attempt.correct) && (
                <span className="nav-count">
                  {attempts.filter((i) => !i.attempt.correct).length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="tiny-stars">✧</div>
          <h3>One concept at a time.</h3>
          <p>
            Small steps today.
            <br />A stronger you on exam day.
          </p>
          <div className="note-line" />
        </div>
        <div className="sidebar-bottom">
          <div className="avatar">
            {profile?.name?.[0]?.toUpperCase() || "Y"}
          </div>
          <div>
            <strong>{profile?.name || "Your next chapter"}</strong>
            <small>GATE 2027 aspirant</small>
          </div>
          {profile ? (
            <button
              className="icon-button logout-button"
              onClick={() => switchProfile(null)}
              disabled={!!busy}
              aria-label="Log out and switch student"
              title="Log out and switch student"
            >
              <LogOut size={19} />
            </button>
          ) : (
            <GraduationCap size={20} />
          )}
        </div>
      </aside>
      <main>
        <header className="topbar">
          <button
            className="mobile-toggle icon-button"
            onClick={() => setMobile(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <span>
            Workspace <ChevronRight size={13} />{" "}
            <strong>
              {page === "practice"
                ? "Practice room"
                : page === "history"
                  ? "Question history"
                  : "Your syllabus"}
            </strong>
          </span>
          <a href={syllabusUrl} target="_blank" rel="noreferrer">
            GATE 2027 <span className="live-dot" /> <ExternalLink size={13} />
          </a>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">A LITTLE PROGRESS, EVERY DAY</div>
              <h1>
                {page === "practice"
                  ? `Let’s make it click${profile ? ", " + profile.name.split(" ")[0] : ""}.`
                  : page === "history"
                    ? "Every attempt teaches you."
                    : "Your path, one topic at a time."}
              </h1>
              <p>
                {page === "practice"
                  ? "Your goal is big. Your next step doesn’t have to be."
                  : page === "history"
                    ? "Revisit your questions, understand your mistakes, and keep moving."
                    : "Everything you need to cover, from the official GATE 2027 DA syllabus."}
              </p>
            </div>
            <div className="heading-tag">
              <span>✦</span> Built around your pace
            </div>
          </div>
          {error && (
            <div className="error" role="alert">
              <XCircle size={18} />
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {!profile && (
            <section className="profile-chooser" aria-label="Choose a student">
              {savedProfiles.length > 0 && (
                <>
                  <div className="profile-heading">
                    <div>
                      <h2>Who’s practising today?</h2>
                      <p>
                        Continue with a student saved in this browser, or add
                        someone new.
                      </p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setCreatingProfile(true)}
                      disabled={!!busy}
                    >
                      New student <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="saved-profiles">
                    {savedProfiles.map((person) => (
                      <button
                        className="saved-profile"
                        key={person.id}
                        onClick={() => switchProfile(person)}
                        disabled={!!busy}
                      >
                        <span className="avatar">
                          {person.name[0].toUpperCase()}
                        </span>
                        <span>
                          <strong>{person.name}</strong>
                          <small>Continue practising</small>
                        </span>
                        <ArrowRight size={16} />
                      </button>
                    ))}
                  </div>
                </>
              )}
              {(creatingProfile || savedProfiles.length === 0) && (
                <form className="welcome-card" onSubmit={register}>
                  <div className="welcome-icon">
                    <GraduationCap size={24} />
                  </div>
                  <div>
                    <h3>Add a new student</h3>
                    <p>
                      Your practice and progress will belong to this profile.
                    </p>
                  </div>
                  <label className="sr-only" htmlFor="student-name">
                    Student name
                  </label>
                  <input
                    id="student-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your first name"
                    required
                    maxLength={60}
                    autoComplete="given-name"
                  />
                  <button
                    className="button primary"
                    disabled={!!busy || !name.trim()}
                  >
                    {busy === "profile" ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : (
                      <>
                        Let’s begin <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                  {savedProfiles.length > 0 && (
                    <button
                      type="button"
                      className="text-button"
                      disabled={!!busy}
                      onClick={() => {
                        setCreatingProfile(false);
                        setName("");
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </form>
              )}
            </section>
          )}
          <div className="stats-row">
            <Stat
              icon={<Target size={19} />}
              value={attempts.length}
              label="Questions attempted"
              note="Every attempt counts"
            />
            <Stat
              icon={<TrendingUp size={19} />}
              value={`${accuracy}%`}
              label="Your accuracy"
              note={
                attempts.length
                  ? "You’re finding your rhythm"
                  : "A fresh start awaits"
              }
            />
            <Stat
              icon={<BookOpen size={19} />}
              value={`${mastered} / ${count}`}
              label="Topics practised correctly"
              note="Build your foundations"
            />
          </div>
          {page === "practice" && (
            <div className="practice-layout">
              <div className="practice-main">
                {!question ? (
                  <>
                    <div className="hero-card">
                      <div className="hero-text">
                        <div className="hero-pill">
                          <span />
                          YOUR NEXT BREAKTHROUGH
                        </div>
                        <h2>
                          A little practice.
                          <br />A lot more <em>possibility.</em>
                        </h2>
                        <p>
                          Pick a topic. Challenge yourself.
                          <br />
                          Understand the why behind every answer.
                        </p>
                        <div className="hero-bottom">
                          <span>
                            <CheckCircle2 size={14} /> Syllabus aligned
                          </span>
                          <span>
                            <Sparkles size={14} /> Powered by Gemini
                          </span>
                        </div>
                      </div>
                      <div className="hero-art" aria-hidden="true">
                        <div className="orbit orbit-one" />
                        <div className="orbit orbit-two" />
                        <span className="art-star">✳</span>
                        <div className="art-card">
                          <span>YOUR DAILY EQUATION</span>
                          <strong>
                            curiosity
                            <br />
                            <b>+</b> consistency
                          </strong>
                          <div>= growth ↗</div>
                        </div>
                        <span className="art-spark">✦</span>
                        <div className="art-small">you’ve got this.</div>
                      </div>
                    </div>
                    <div className="section-title">
                      <div>
                        <h2>Where do you want to begin?</h2>
                        <p>Choose a subject to find your focus.</p>
                      </div>
                      <span>07 SUBJECTS</span>
                    </div>
                    <div className="subject-grid">
                      {subjects.map((s) => (
                        <button
                          key={s.id}
                          className={`subject-card ${s.id === subjectId ? "selected" : ""}`}
                          onClick={() => chooseSubject(s.id)}
                        >
                          <span className="subject-symbol">{s.icon}</span>
                          <div>
                            <h3>{s.name}</h3>
                            <p>{s.topics.length} topics to explore</p>
                          </div>
                          <span className="subject-check">
                            {s.id === subjectId ? (
                              <Check size={15} />
                            ) : (
                              <ArrowUpRight size={17} />
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="gentle-note">
                      <Lightbulb size={18} />
                      <p>
                        <strong>Understanding beats memorising.</strong> Take a
                        moment with the explanation after every question.
                      </p>
                    </div>
                  </>
                ) : (
                  <section className="quiz-card">
                    <div className="quiz-topline">
                      <span className="eyebrow">
                        {review ? "PAST ATTEMPT" : "YOUR FOCUS SESSION"}
                      </span>
                      <button
                        className="text-button"
                        onClick={() => {
                          setQuestion(null);
                          setResult(null);
                        }}
                      >
                        Change subject <ArrowUpRight size={14} />
                      </button>
                    </div>
                    <div className="quiz-badges">
                      <span className="badge">{question.type}</span>
                      <span className={`badge level-${question.difficulty}`}>
                        {levels[question.difficulty - 1]} difficulty
                      </span>
                      <span className="badge subtle">
                        {subjects.find((s) => s.id === question.subject)?.name}
                      </span>
                    </div>
                    <p className="question-topic">{question.topic}</p>
                    <h2 className="question-prompt">{question.prompt}</h2>
                    {image && (
                      <img
                        className="question-image"
                        src={image}
                        alt="Question data chart"
                      />
                    )}
                    <p className="answer-instruction">
                      {question.type === "MCQ"
                        ? "Select one correct answer."
                        : question.type === "MSQ"
                          ? "Select all correct answers. More than one option is correct."
                          : "Enter your numerical answer. Follow the rounding instruction in the question."}
                    </p>
                    {question.type === "NAT" ? (
                      <label className="numeric-label">
                        Your answer
                        <input
                          className="numeric-input"
                          inputMode="decimal"
                          placeholder="e.g. 0.75"
                          value={answer}
                          disabled={!!result || !!busy}
                          onChange={(e) => setAnswer(e.target.value)}
                        />
                      </label>
                    ) : (
                      <div className="options">
                        {question.options.map((option, i) => {
                          const chosen =
                            Array.isArray(answer) && answer.includes(i);
                          const right =
                            result?.solution.correctOptions.includes(i);
                          return (
                            <button
                              key={i}
                              disabled={!!result || !!busy}
                              className={`option ${chosen ? "chosen" : ""} ${result ? (right ? "right" : chosen ? "wrong" : "") : ""}`}
                              onClick={() => selectOption(i)}
                              aria-pressed={chosen}
                            >
                              <span
                                className={`option-letter ${question.type === "MSQ" ? "square" : ""}`}
                              >
                                {result && right ? (
                                  <Check size={15} />
                                ) : (
                                  String.fromCharCode(65 + i)
                                )}
                              </span>
                              <span>{option}</span>
                              {chosen && !result && <Check size={17} />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {!result && (
                      <div className="quiz-actions">
                        <button
                          className="text-button"
                          onClick={() => setHint((v) => !v)}
                        >
                          <Lightbulb size={16} />
                          {hint ? "Hide hint" : "A little hint"}
                        </button>
                        <button
                          className="button primary"
                          disabled={!validAnswer || !!busy}
                          onClick={submit}
                        >
                          {busy === "answer" ? (
                            <>
                              <LoaderCircle className="spin" size={17} />{" "}
                              Checking…
                            </>
                          ) : (
                            <>
                              Confirm answer <ArrowRight size={17} />
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    {hint && !result && (
                      <p className="hint-box">{question.hint}</p>
                    )}
                    {result && (
                      <div
                        className={`solution ${result.attempt.correct ? "correct" : "incorrect"}`}
                        role="status"
                      >
                        <div className="solution-title">
                          {result.attempt.correct ? (
                            <CheckCircle2 size={22} />
                          ) : (
                            <XCircle size={22} />
                          )}
                          <div>
                            <h3>
                              {result.attempt.correct
                                ? "That’s right. Nicely done!"
                                : "A mistake is a place to grow."}
                            </h3>
                            <p>
                              {result.attempt.correct
                                ? "Let’s understand what made it work."
                                : "This question is saved in your mistakes for later."}
                            </p>
                          </div>
                        </div>
                        <div className="correct-answer">
                          <strong>Correct answer</strong>
                          <span>
                            {question.type === "NAT"
                              ? result.solution.numericMin ===
                                result.solution.numericMax
                                ? result.solution.numericMin
                                : `${result.solution.numericMin} to ${result.solution.numericMax}`
                              : result.solution.correctOptions
                                  .map(
                                    (i) =>
                                      `${String.fromCharCode(65 + i)}. ${question.options[i]}`,
                                  )
                                  .join("\n")}
                          </span>
                        </div>
                        <h4>Step-by-step explanation</h4>
                        <p className="explanation">
                          {result.solution.explanation}
                        </p>
                        <p className="difficulty-reason">
                          <strong>
                            Why {levels[question.difficulty - 1].toLowerCase()}{" "}
                            difficulty?
                          </strong>{" "}
                          {result.solution.difficultyReason}
                        </p>
                        {progressive && !review && (
                          <div className="progress-message">
                            <TrendingUp size={16} />
                            Next question: {levels[difficulty - 1]} difficulty.
                            Adjust it any time.
                          </div>
                        )}
                        <button
                          className="button primary"
                          disabled={!!busy}
                          onClick={generateQuestion}
                        >
                          {busy === "generate" ? (
                            <>
                              <LoaderCircle className="spin" size={17} />{" "}
                              Preparing…
                            </>
                          ) : (
                            <>
                              Next question <ArrowRight size={17} />
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    <div className="ai-note">
                      <Sparkles size={13} /> AI-generated practice. Explanations
                      can contain errors; verify any doubtful result.
                    </div>
                  </section>
                )}
              </div>
              <aside className="session-panel">
                <div className="panel-heading">
                  <div className="panel-icon">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h2>Make it your session</h2>
                    <p>A plan that fits your pace.</p>
                  </div>
                </div>
                <label className="field-label" htmlFor="paper">
                  <span>01</span> Your paper
                </label>
                <select id="paper" value="DA" onChange={() => {}}>
                  <option value="DA">DA · Data Science & AI</option>
                  <option disabled>CS · Computer Science — soon</option>
                  <option disabled>EC · Electronics — soon</option>
                  <option disabled>EE · Electrical — soon</option>
                  <option disabled>ME · Mechanical — soon</option>
                  <option disabled>CE · Civil — soon</option>
                </select>
                <div className="field-caption">
                  <span className="live-dot" /> DA is ready. More papers are on
                  the way.
                </div>
                <label className="field-label" htmlFor="subject">
                  <span>02</span> Pick your subject
                </label>
                <select
                  id="subject"
                  value={subjectId}
                  onChange={(e) => chooseSubject(e.target.value)}
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <label className="field-label" htmlFor="topic">
                  <span>03</span> Find your focus
                </label>
                <select
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                >
                  {subject.topics.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <label className="field-label">
                  <span>04</span> Set your challenge
                </label>
                <div className="difficulty-buttons">
                  {levels.map((l, i) => (
                    <button
                      key={l}
                      className={difficulty === i + 1 ? "selected" : ""}
                      onClick={() => setDifficulty(i + 1)}
                    >
                      <span className="bars">
                        {Array.from({ length: i + 1 }, (_, j) => (
                          <i key={j} />
                        ))}
                      </span>
                      {l}
                    </button>
                  ))}
                </div>
                <div className="adaptive">
                  <div>
                    <strong>
                      <TrendingUp size={15} /> Progressive mode
                    </strong>
                    <p>Difficulty grows as you get it right.</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={progressive}
                    aria-label="Progressive difficulty"
                    className={`toggle ${progressive ? "on" : ""}`}
                    onClick={() => setProgressive((v) => !v)}
                  >
                    <span />
                  </button>
                </div>
                <label className="format-label" htmlFor="format">
                  Question format
                </label>
                <select
                  id="format"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="MIXED">Mix it up · MCQ, MSQ & NAT</option>
                  <option value="MCQ">MCQ · One correct option</option>
                  <option value="MSQ">MSQ · Multiple correct options</option>
                  <option value="NAT">NAT · Numerical answer</option>
                </select>
                <button
                  className="button primary start-button"
                  disabled={!!busy}
                  onClick={generateQuestion}
                >
                  {busy === "generate" ? (
                    <>
                      <LoaderCircle className="spin" size={17} /> Preparing your
                      question…
                    </>
                  ) : (
                    <>
                      {question
                        ? "Generate a new question"
                        : "Start practising"}
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
                <p className="panel-footer">One question. One step closer.</p>
              </aside>
            </div>
          )}
          {page === "history" && (
            <section className="history-section">
              <div className="history-toolbar">
                <div className="filter-tabs">
                  {[
                    ["all", "All questions"],
                    ["mistakes", "Mistakes"],
                    ["correct", "Correct"],
                    ["unanswered", "Unanswered"],
                  ].map(([id, label]) => (
                    <button
                      className={filter === id ? "active" : ""}
                      onClick={() => setFilter(id)}
                      key={id}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button className="text-button" onClick={loadHistory}>
                  <RotateCcw size={14} />
                  Refresh
                </button>
              </div>
              <div className="history-list">
                {items
                  .filter(
                    (i) =>
                      filter === "all" ||
                      (filter === "mistakes" &&
                        i.attempt &&
                        !i.attempt.correct) ||
                      (filter === "correct" && i.attempt?.correct) ||
                      (filter === "unanswered" && !i.attempt),
                  )
                  .map((i) => (
                    <button
                      className="history-item"
                      key={i.question.id}
                      onClick={() => openItem(i)}
                    >
                      <span
                        className={`history-icon ${i.attempt ? (i.attempt.correct ? "passed" : "failed") : ""}`}
                      >
                        {i.attempt ? (
                          i.attempt.correct ? (
                            <CheckCircle2 size={20} />
                          ) : (
                            <XCircle size={20} />
                          )
                        ) : (
                          <BookOpen size={20} />
                        )}
                      </span>
                      <div>
                        <div className="history-meta">
                          {i.question.type} ·{" "}
                          {levels[i.question.difficulty - 1]} ·{" "}
                          {new Date(i.question.createdAt).toLocaleDateString(
                            "en-IN",
                            { day: "numeric", month: "short" },
                          )}
                        </div>
                        <h3>{i.question.prompt}</h3>
                        <p>{i.question.topic}</p>
                      </div>
                      <ChevronRight size={18} />
                    </button>
                  ))}
              </div>
              {!items.some(
                (i) =>
                  filter === "all" ||
                  (filter === "mistakes" && i.attempt && !i.attempt.correct) ||
                  (filter === "correct" && i.attempt?.correct) ||
                  (filter === "unanswered" && !i.attempt),
              ) && (
                <div className="empty-state">
                  <BookOpen size={34} />
                  <h2>
                    {filter === "mistakes"
                      ? "A clean slate. Keep exploring."
                      : "Your next chapter starts with a question."}
                  </h2>
                  <p>Your saved practice will appear here.</p>
                  <button
                    className="button primary"
                    onClick={() => navigate("practice")}
                  >
                    Go to practice <ArrowRight size={16} />
                  </button>
                </div>
              )}
              <p className="history-footnote">
                Showing the latest 200 saved questions. Your first submitted
                answer is preserved.
              </p>
            </section>
          )}
          {page === "syllabus" && (
            <section className="syllabus-section">
              <div className="syllabus-intro">
                <div>
                  <h2>DA · Data Science & Artificial Intelligence</h2>
                  <p>7 subjects · {count} topic groups · GATE 2027</p>
                </div>
                <a
                  className="text-button"
                  href={syllabusUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Official syllabus <ExternalLink size={15} />
                </a>
              </div>
              {subjects.map((s) => (
                <details className="syllabus-subject" key={s.id}>
                  <summary>
                    <span className="subject-symbol">{s.icon}</span>
                    <strong>{s.name}</strong>
                    <span>{s.topics.length} topics</span>
                    <ChevronRight size={17} />
                  </summary>
                  <div className="topic-list">
                    {s.topics.map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          setSubjectId(s.id);
                          setTopic(t);
                          setQuestion(null);
                          setResult(null);
                          navigate("practice");
                        }}
                      >
                        <span
                          className={`topic-dot ${attempts.some((i) => i.question.topic === t && i.attempt.correct) ? "done" : ""}`}
                        />
                        {t}
                        <ArrowUpRight size={14} />
                      </button>
                    ))}
                  </div>
                </details>
              ))}
            </section>
          )}
          <footer className="page-footer">
            <span>Made for the moments when you choose to try.</span>
            <span>
              her. <span className="footer-star">✳</span> your potential, in
              progress.
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
function Stat({ icon, value, label, note }) {
  return (
    <div className="stat">
      <div className="stat-icon">{icon}</div>
      <div className="stat-main">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
