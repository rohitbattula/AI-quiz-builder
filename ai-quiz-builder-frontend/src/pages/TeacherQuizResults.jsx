import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../lib/api";

export default function TeacherQuizResults() {
  const { quizId } = useParams();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const resp = await api.get(`/quizzes/${quizId}/results`);
        const payload = resp?.data || {};
        const quizMeta = payload.quiz || null;
        const attempts = Array.isArray(payload.attempts)
          ? payload.attempts
          : [];

        if (!cancel) {
          setMeta(quizMeta);
          setRows(attempts);
        }
      } catch (e) {
        if (!cancel)
          setErr(
            e?.response?.data?.message ||
              e.message ||
              "Failed to load quiz results"
          );
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [quizId]);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-xl font-semibold">Quiz Results</h1>

      {meta && (
        <div className="mt-2 text-sm text-gray-700">
          <div>
            <span className="font-medium">Title:</span> {meta.title || "—"}
          </div>
          <div>
            <span className="font-medium">Topic:</span> {meta.topic || "—"}
          </div>
          <div className="text-xs text-gray-500">Quiz ID: {meta.id}</div>
        </div>
      )}

      {err && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <section className="mt-4 rounded-xl border bg-white p-4">
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-gray-600">No submissions yet.</div>
        ) : (
          <ul className="divide-y">
            {rows.map((r, i) => (
              <li key={i} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.name ?? "—"}</div>
                  <div className="truncate text-sm text-gray-600">
                    {r.email ?? "—"}
                  </div>
                  <div className="text-xs text-gray-500">
                    Submitted:{" "}
                    {r.submittedAt
                      ? new Date(r.submittedAt).toLocaleString()
                      : "—"}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-semibold">
                    {r.score} / {r.totalPoints ?? "—"}
                  </div>
                  <div className="text-xs text-gray-500">
                    Correct: {r.correctCount ?? 0}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-3">
        <Link
          to="/t/results"
          className="inline-block rounded-md px-2 py-1 text-xs ring-1 ring-gray-300 hover:bg-gray-50"
        >
          ← Back
        </Link>
      </div>
    </div>
  );
}
