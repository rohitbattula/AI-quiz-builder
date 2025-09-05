import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthProvider";

export default function StudentResult() {
  const { quizId } = useParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [quiz, setQuiz] = useState({ title: "", topic: "" });
  const [score, setScore] = useState(null);
  const [maxScore, setMaxScore] = useState(null);
  const [submittedAt, setSubmittedAt] = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        // meta
        const st = await api.get(`/quizzes/${quizId}/status`);
        if (!cancel)
          setQuiz({ title: st.data?.title || "", topic: st.data?.topic || "" });

        // leaderboard -> pick my row
        const lb = await api.get(`/quizzes/${quizId}/leaderboard`);
        const mine = (lb.data?.leaderboard || []).find(
          (row) => String(row.user) === String(user?.id)
        );
        if (!mine) throw new Error("result not found");
        if (!cancel) {
          setScore(mine.score ?? 0);
          setMaxScore(mine.maxScore ?? 0);
          setSubmittedAt(mine.submittedAt || null);
        }
      } catch (e) {
        if (!cancel)
          setErr(
            e?.response?.data?.message || e.message || "Failed to load result"
          );
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [quizId, user?.id]);

  const pct =
    maxScore && maxScore > 0
      ? Math.round((Number(score || 0) / Number(maxScore)) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Quiz Ended</h1>
      <p className="text-sm text-gray-600">
        {quiz.title} — <span className="font-medium">{quiz.topic || "—"}</span>
      </p>

      {loading ? (
        <div className="mt-4 rounded border bg-white p-4 text-sm text-gray-600">
          Loading…
        </div>
      ) : err ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border bg-white p-5">
          <div className="text-lg">
            Score: <span className="font-semibold">{score}</span> /{" "}
            <span>{maxScore}</span> ({pct}%)
          </div>
          {submittedAt && (
            <div className="mt-1 text-xs text-gray-500">
              Submitted: {new Date(submittedAt).toLocaleString()}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <Link
              to="/marks"
              className="rounded-md px-3 py-1.5 text-sm ring-1 ring-gray-300 hover:bg-gray-50"
            >
              My Marks
            </Link>
            <Link
              to="/"
              className="rounded-md px-3 py-1.5 text-sm ring-1 ring-gray-300 hover:bg-gray-50"
            >
              Dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
