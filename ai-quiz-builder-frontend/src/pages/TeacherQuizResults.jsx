import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../lib/api";
import Pagination from "../components/Pagination";

const LIMIT = 10;

// Safely normalize various server response shapes
function normalizeResultsPayload(payload) {
  const body = payload ?? {};
  const dataNode = body.data ?? {};

  const quiz = body.quiz ?? dataNode.quiz ?? null;

  // attempts can be in several places depending on backend version
  const rawAttempts = Array.isArray(body.attempts)
    ? body.attempts
    : Array.isArray(body.items)
    ? body.items
    : Array.isArray(dataNode.attempts)
    ? dataNode.attempts
    : Array.isArray(dataNode.items)
    ? dataNode.items
    : [];

  // pagination meta (optional)
  const page = Number(body.page ?? dataNode.page ?? 1) || 1;
  const totalPages = Number(body.totalPages ?? dataNode.totalPages ?? 1) || 1;

  // Normalize each row
  const attempts = rawAttempts.map((a, i) => {
    const user = a.user || {};
    return {
      id: a._id || a.id || i,
      name: a.name ?? user.name ?? "—",
      email: a.email ?? user.email ?? "—",
      score: a.score ?? 0,
      totalPoints: a.totalPoints ?? a.maxScore ?? "—",
      correctCount: a.correctCount ?? 0,
      submittedAt: a.submittedAt || a.updatedAt || null,
    };
  });

  return { quiz, attempts, page, totalPages };
}

export default function TeacherQuizResults() {
  const { quizId } = useParams();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  async function load(p = page) {
    setLoading(true);
    setErr("");
    try {
      const resp = await api.get(`/quizzes/${quizId}/results`, {
        params: { page: p, limit: LIMIT },
      });
      const {
        quiz,
        attempts,
        page: cur,
        totalPages: tp,
      } = normalizeResultsPayload(resp?.data);
      setMeta(quiz);
      setRows(attempts);
      setPage(cur || p);
      setTotalPages(tp || 1);
    } catch (e) {
      setErr(
        e?.response?.data?.message || e.message || "Failed to load quiz results"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPage(1); // reset to first page when quizId changes
  }, [quizId]);

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, quizId]);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Quiz Results</h1>
        <Link
          to="/t/results"
          className="inline-block rounded-md px-3 py-1 text-sm ring-1 ring-gray-300 hover:bg-gray-50"
        >
          ← Back to All Results
        </Link>
      </div>

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
          <>
            <ul className="divide-y">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{r.name}</div>
                    <div className="truncate text-sm text-gray-600">
                      {r.email}
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
                      {r.score} / {r.totalPoints}
                    </div>
                    <div className="text-xs text-gray-500">
                      Correct: {r.correctCount}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={page} totalPages={totalPages} onPage={setPage} />
          </>
        )}
      </section>
    </div>
  );
}
