import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthProvider";

const AI_GENERATE_PATH = "/ai/quizzes/generate";

function OptionInputs({ qIndex, options, onChange, disabled }) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {options.map((opt, i) => (
        <input
          key={i}
          type="text"
          placeholder={`Option ${i + 1}`}
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={opt}
          onChange={(e) => onChange(qIndex, i, e.target.value)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

function ManualQuestion({ idx, q, setQ, remove }) {
  const setText = (v) => setQ(idx, { ...q, text: v });
  const setPoints = (v) =>
    setQ(idx, { ...q, points: Math.max(1, Number(v || 1)) });
  const setOption = (qi, oi, v) => {
    const next = q.options.slice();
    next[oi] = v;
    setQ(qi, { ...q, options: next });
  };
  const setCorrect1to4 = (v) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 4) return;
    setQ(idx, { ...q, correctIndex: n - 1 });
  };

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <div className="grow">
          <label className="block text-sm font-medium mb-1">
            Question {idx + 1}
          </label>
          <textarea
            className="w-full rounded-md border px-3 py-2 text-sm min-h-20"
            placeholder="Enter question text"
            value={q.text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => remove(idx)}
          className="shrink-0 rounded-md px-2 py-1 text-sm ring-1 ring-gray-300 hover:bg-gray-50"
          aria-label="Remove question"
        >
          Remove
        </button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium mb-1">Options</label>
          <OptionInputs
            qIndex={idx}
            options={q.options}
            onChange={setOption}
            disabled={false}
          />
        </div>
        <div className="grid gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">
              Correct option (1–4)
            </label>
            <input
              type="text"
              inputMode="numeric"
              className="w-32 rounded-md border px-3 py-2 text-sm"
              value={(q.correctIndex ?? 0) + 1}
              onChange={(e) => setCorrect1to4(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">
              Converted to 0–3 for the backend.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Points</label>
            <input
              type="text"
              inputMode="numeric"
              className="w-32 rounded-md border px-3 py-2 text-sm"
              value={q.points}
              onChange={(e) => setPoints(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CreateQuiz() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [durationMin, setDurationMin] = useState("");
  const [allowLateJoin, setAllowLateJoin] = useState(false);

  // manual
  const blankQ = () => ({
    text: "",
    options: ["", "", "", ""],
    correctIndex: 0,
    points: 1,
  });
  const [manualQs, setManualQs] = useState([blankQ()]);
  const addManualQ = () => setManualQs((a) => [...a, blankQ()]);
  const setManualQ = (i, next) =>
    setManualQs((a) => a.map((q, idx) => (idx === i ? next : q)));
  const removeManualQ = (i) =>
    setManualQs((a) => a.filter((_, idx) => idx !== i));

  // AI
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQs, setAiQs] = useState(null); // [{ text, options[4], correctIndex, points? }]
  const [aiPromptNote, setAiPromptNote] = useState("");
  const [aiNumQuestions, setAiNumQuestions] = useState("10");

  // submit state
  const [creating, setCreating] = useState(false);
  const isTeacher = user?.role === "teacher";

  const onPickFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    const newMap = new Map(
      [...files, ...picked].map((f) => [`${f.name}__${f.size}`, f])
    );
    setFiles(Array.from(newMap.values()));
    e.target.value = "";
  };
  const removeFileAt = (i) =>
    setFiles((arr) => arr.filter((_, idx) => idx !== i));
  const removeAIAt = (i) => setAiQs((arr) => arr.filter((_, idx) => idx !== i));
  const setAIPoints = (i, v) => {
    const pts = Math.max(1, Number(v || 1));
    setAiQs((arr) => {
      const next = arr.slice();
      next[i] = { ...next[i], points: pts };
      return next;
    });
  };

  async function handleAIGenerate() {
    if (!title.trim() || !topic.trim())
      return alert("Please fill Title and Topic first.");
    const qty = Math.max(1, Number(aiNumQuestions || 10));

    const fd = new FormData();
    fd.append("title", title);
    fd.append("topic", topic);
    fd.append("difficulty", difficulty || "medium");
    fd.append("numQuestions", String(qty));
    files.forEach((f) => fd.append("files", f));

    setAiLoading(true);
    try {
      const { data } = await api.post(AI_GENERATE_PATH, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (
        !data?.success ||
        !Array.isArray(data?.questions) ||
        !data.questions.length
      ) {
        throw new Error(data?.message || "AI did not return questions");
      }
      const enriched = data.questions.map((q) => ({
        ...q,
        points: Number(q.points || 1),
      }));
      setAiQs(enriched);
      setAiPromptNote(data.aiPromptNote || "");
    } catch (e) {
      alert(e?.response?.data?.message || e.message || "AI generation failed");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!isTeacher) return alert("Only teachers can create quizzes.");

    const mins = Number(durationMin || 0);
    if (!mins || mins < 1) return alert("Please provide duration (minutes).");

    // Combine AI + non-empty manual questions
    const manualNonEmpty = manualQs.filter(
      (q) =>
        (q.text && q.text.trim().length > 0) ||
        q.options.some((o) => (o || "").trim())
    );
    const combined = [...(aiQs || []), ...manualNonEmpty];

    const payload = {
      title: title.trim(),
      topic: topic.trim(),
      difficulty,
      durationSec: Math.round(mins * 60),
      allowLateJoin,
      aiPromptNote: aiPromptNote || undefined,
      questions: combined.map((q) => ({
        text: String(q.text).trim(),
        options: q.options.map((o) => String(o ?? "")),
        correctIndex: Number(q.correctIndex ?? 0),
        points: Math.max(1, Number(q.points || 1)),
      })),
    };

    if (!payload.title || !payload.topic)
      return alert("Title and Topic are required.");
    if (!Array.isArray(payload.questions) || !payload.questions.length)
      return alert("At least one question is required.");
    for (let i = 0; i < payload.questions.length; i++) {
      const q = payload.questions[i];
      if (!q.text) return alert(`Question ${i + 1}: text required`);
      if (!Array.isArray(q.options) || q.options.length !== 4)
        return alert(`Question ${i + 1}: exactly 4 options required`);
      if (
        !Number.isInteger(q.correctIndex) ||
        q.correctIndex < 0 ||
        q.correctIndex > 3
      )
        return alert(`Question ${i + 1}: Correct option must be 1–4`);
      if (!q.points || q.points < 1)
        return alert(`Question ${i + 1}: points must be ≥ 1`);
    }

    try {
      setCreating(true);
      const { data } = await api.post("/quizzes", payload);
      const quiz = data?.quiz;
      if (!quiz?._id) throw new Error(data?.message || "Create failed");
      nav(`/t/${quiz._id}`); // straight to lobby
    } catch (e) {
      alert(e?.response?.data?.message || e.message || "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="mx-auto max-w-5xl flex items-center justify-between px-4 py-4">
        <h1 className="text-xl font-semibold">Create Quiz</h1>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16">
        <form onSubmit={handleCreate} className="grid gap-6">
          {/* Basics */}
          <section className="rounded-xl bg-white p-5 shadow grid gap-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="e.g., DSA Basics"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Topic</label>
                <input
                  type="text"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="e.g., Arrays"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Difficulty
                </label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  <option value="easy">easy</option>
                  <option value="medium">medium</option>
                  <option value="hard">hard</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Duration (minutes)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="e.g., 15"
                  value={durationMin}
                  onChange={(e) => setDurationMin(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allowLateJoin}
                    onChange={(e) => setAllowLateJoin(e.target.checked)}
                  />
                  <span className="text-sm">Allow late join</span>
                </label>
              </div>
            </div>
          </section>

          {/* AI helper */}
          <section className="rounded-xl bg-white p-5 shadow grid gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                AI generate questions (optional)
              </h2>
              {/* removed “switch to manual” — manual section is always available below */}
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Number of questions
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="e.g., 10"
                  value={aiNumQuestions}
                  onChange={(e) => setAiNumQuestions(e.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Upload files (PDF/TXT/MD/CSV/JSON) — multiple allowed
                </label>

                <input
                  ref={fileInputRef}
                  id="ai-files"
                  type="file"
                  multiple
                  accept=".pdf,.txt,.md,.csv,.json"
                  onChange={onPickFiles}
                  className="hidden"
                />

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={aiLoading}
                    className="rounded-md px-3 py-1.5 text-sm ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {aiLoading ? "Uploading…" : "Upload files"}
                  </button>
                  <span className="text-sm text-gray-600">
                    {files.length
                      ? `${files.length} file(s) selected`
                      : "No files chosen"}
                  </span>
                </div>

                {!!files.length && (
                  <ul className="mt-2 divide-y rounded border">
                    {files.map((f, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between px-3 py-2"
                      >
                        <span className="text-sm truncate">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFileAt(i)}
                          className="rounded-md px-2 py-1 text-xs ring-1 ring-gray-300 hover:bg-gray-50"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={handleAIGenerate}
                disabled={aiLoading}
                className="rounded-md px-3 py-1.5 text-sm ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-60"
              >
                {aiLoading ? "Generating…" : "Generate with AI"}
              </button>
            </div>

            {aiQs && (
              <div className="mt-3">
                <p className="text-sm text-gray-600">
                  AI generated <strong>{aiQs.length}</strong> questions. You can
                  still add or edit manual questions below.
                </p>
                <ol className="mt-2 grid gap-3">
                  {aiQs.map((q, i) => (
                    <li key={i} className="rounded-md border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">
                          {i + 1}. {q.text}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeAIAt(i)}
                          className="rounded-md px-2 py-1 text-xs ring-1 ring-gray-300 hover:bg-gray-50"
                        >
                          Remove
                        </button>
                      </div>

                      <ul className="mt-1 list-disc pl-4 text-sm">
                        {q.options.map((o, j) => (
                          <li key={j}>
                            {String.fromCharCode(65 + j)}. {o}
                            {j === q.correctIndex ? " (correct)" : ""}
                          </li>
                        ))}
                      </ul>

                      <div className="mt-2">
                        <label className="block text-xs font-medium mb-1">
                          Points
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="w-24 rounded-md border px-3 py-1.5 text-sm"
                          value={q.points ?? 1}
                          onChange={(e) => setAIPoints(i, e.target.value)}
                        />
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>

          {/* Manual editor — ALWAYS visible */}
          <section className="rounded-xl bg-white p-5 shadow grid gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Manual questions</h2>
              <button
                type="button"
                onClick={addManualQ}
                className="rounded-md px-3 py-1.5 text-sm ring-1 ring-gray-300 hover:bg-gray-50"
              >
                + Add question
              </button>
            </div>

            <div className="grid gap-4">
              {manualQs.map((q, i) => (
                <ManualQuestion
                  key={i}
                  idx={i}
                  q={q}
                  setQ={setManualQ}
                  remove={removeManualQ}
                />
              ))}
            </div>
          </section>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={creating || aiLoading}
              aria-busy={creating}
              className="rounded-md px-4 py-2 text-sm ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
            >
              {creating ? "Creating…" : "Create quiz"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
