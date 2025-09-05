import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";

export default function MyMarks() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data } = await api.get("/attempts/mine");
        if (!cancel)
          setRows(Array.isArray(data?.attempts) ? data.attempts : []);
      } catch (e) {
        if (!cancel)
          setErr(
            e?.response?.data?.message || e.message || "Failed to load marks"
          );
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-xl font-semibold">My Marks</h1>

      {err && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <section className="mt-4 rounded-xl border bg-white p-4">
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-gray-600">No attempts yet.</div>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.quizTitle}</div>
                  <div className="truncate text-sm text-gray-600">
                    Topic: {r.quizTopic}
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
                    {r.score} / {r.maxScore ?? r.totalPoints}
                  </div>
                  <Link
                    to={`/results/${r.quizId}`}
                    className="mt-1 inline-block rounded-md px-2 py-1 text-xs ring-1 ring-gray-300 hover:bg-gray-50"
                  >
                    View
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
