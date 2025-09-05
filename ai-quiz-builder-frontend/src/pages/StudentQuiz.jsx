// src/pages/StudentQuiz.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { getSocket } from "../lib/socket";

export default function StudentQuiz() {
  const { quizId } = useParams();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState({
    title: "",
    topic: "",
    durationSec: 0,
    questions: [],
  });
  const [status, setStatus] = useState({
    startedAt: null,
    endsAt: null,
    state: "active",
  });
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // qIndex -> selectedIndex
  const [saving, setSaving] = useState({}); // qIndex -> true|false (used only to disable)
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  const endsAtMs = useMemo(
    () => (status.endsAt ? new Date(status.endsAt).getTime() : null),
    [status.endsAt]
  );

  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef(null);

  // Bootstrap: ensure active, start attempt, fetch questions (all using your routes)
  useEffect(() => {
    let cancel = false;

    async function bootstrap() {
      try {
        const { data: st } = await api.get(`/quizzes/${quizId}/status`);
        if (cancel) return;

        if (st?.status !== "active") {
          nav(`/s/${quizId}`, { replace: true });
          return;
        }

        // Start attempt — server also ensures participant is recorded
        const { data: started } = await api.post(
          `/quizzes/${quizId}/attempts/start`,
          {}
        );
        const endsAt =
          started?.endsAt ||
          st?.endsAt ||
          (st?.startedAt && st?.durationSec
            ? new Date(
                new Date(st.startedAt).getTime() + st.durationSec * 1000
              ).toISOString()
            : null);

        setStatus({
          startedAt: started?.startedAt || st?.startedAt || null,
          endsAt,
          state: "active",
        });

        // Fetch questions
        const { data: qres } = await api.get(`/quizzes/${quizId}/questions`);
        const qs = Array.isArray(qres?.questions) ? qres.questions : [];
        setQuiz({
          title: st?.title || "",
          topic: st?.topic || "",
          durationSec: st?.durationSec || 0,
          questions: qs,
        });

        setLoading(false);
      } catch (e) {
        setNotice(
          e?.response?.data?.message || e.message || "Failed to load quiz"
        );
        setLoading(false);
      }
    }

    bootstrap();
    return () => {
      cancel = true;
    };
  }, [quizId, nav]);

  // Countdown
  useEffect(() => {
    if (!endsAtMs) return;
    const tick = () => {
      const now = Date.now();
      const rem = Math.max(0, Math.floor((endsAtMs - now) / 1000));
      setRemaining(rem);
      if (rem <= 0) {
        // time up → auto submit once
        if (!submitting) submitAttempt(true);
        clearInterval(timerRef.current);
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAtMs]);

  // If teacher ends early
  useEffect(() => {
    const s = getSocket();
    const onEnded = (msg) => {
      if (msg.quizId !== quizId) return;
      setStatus((prev) => ({ ...prev, state: "ended" }));
      submitAttempt(true);
    };
    s.on("quiz:ended", onEnded);
    return () => s.off("quiz:ended", onEnded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  function formatClock(totalSec) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  async function recordAnswer(qIndex, selectedIndex) {
    // update UI immediately
    setAnswers((prev) => ({ ...prev, [qIndex]: selectedIndex }));
    setSaving((prev) => ({ ...prev, [qIndex]: true }));
    try {
      // ← your backend contract
      await api.post(`/quizzes/${quizId}/answers`, {
        qIndex,
        selectedIndex, // 0..3
      });
    } catch (e) {
      setNotice(
        e?.response?.data?.message || e.message || "Failed to save answer"
      );
      // revert if server rejected (optional)
      // setAnswers((prev) => ({ ...prev, [qIndex]: undefined }));
    } finally {
      setSaving((prev) => ({ ...prev, [qIndex]: false }));
    }
  }

  async function submitAttempt(auto = false) {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.post(`/quizzes/${quizId}/submit`, { auto });
      nav(`/results/${quizId}`, { replace: true }); // change later to a marks page if you add one
    } catch (e) {
      setNotice(e?.response?.data?.message || e.message || "Submit failed");
      if (auto) nav("/", { replace: true });
    } finally {
      setSubmitting(false);
    }
  }

  const q = quiz.questions[idx];
  const selected = answers[idx];

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Top bar with title + timer */}
      <header className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">
            {quiz.title || "Quiz"}
          </h1>
          <p className="truncate text-sm text-gray-600">
            Topic: <span className="font-medium">{quiz.topic || "—"}</span>
          </p>
        </div>
        <span
          className="rounded bg-gray-100 px-3 py-1 text-sm font-mono"
          title="Time remaining"
        >
          {formatClock(remaining)}
        </span>
      </header>

      {/* Notice */}
      {notice && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {notice}
        </div>
      )}

      {/* Body */}
      <section className="mt-6 rounded-xl border bg-white p-5">
        {loading ? (
          <div className="text-sm text-gray-600">Loading questions…</div>
        ) : !q ? (
          <div className="text-sm text-gray-600">No questions found.</div>
        ) : (
          <>
            {/* Progress */}
            <div className="mb-3 text-sm text-gray-600">
              Question <span className="font-medium">{idx + 1}</span> of{" "}
              <span className="font-medium">{quiz.questions.length}</span>
              {typeof q.points === "number" ? (
                <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs">
                  Points: {q.points}
                </span>
              ) : null}
            </div>

            {/* Question text */}
            <p className="text-base font-medium">{q.text}</p>

            {/* Options (no Saved/Saving text) */}
            <ul className="mt-4 grid gap-2">
              {q.options.map((opt, oi) => {
                const isSelected = selected === oi;
                const isSaving = saving[idx];
                return (
                  <li key={oi}>
                    <button
                      type="button"
                      onClick={() => recordAnswer(idx, oi)}
                      disabled={isSaving || submitting}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                        isSelected
                          ? "border-blue-300 bg-blue-50"
                          : "border-gray-200 hover:bg-gray-50"
                      } ${isSaving ? "opacity-70" : ""}`}
                    >
                      <span className="mr-2 inline-block w-5 text-center font-mono">
                        {String.fromCharCode(65 + oi)}.
                      </span>
                      {opt}
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Nav / Submit */}
            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                disabled={idx === 0 || submitting}
                className="rounded-md px-3 py-1.5 text-sm ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
              >
                ← Previous
              </button>

              {idx === quiz.questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => submitAttempt(false)}
                  disabled={submitting}
                  className="rounded-md px-4 py-2 text-sm ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-60"
                >
                  {submitting ? "Submitting…" : "Submit"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setIdx((i) => Math.min(quiz.questions.length - 1, i + 1))
                  }
                  disabled={submitting}
                  className="rounded-md px-3 py-1.5 text-sm ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next →
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
