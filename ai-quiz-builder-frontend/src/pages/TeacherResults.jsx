import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";

export default function TeacherResults() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data } = await api.get("/quizzes/mine", {
          params: { status: "ended" },
        });
        const list = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
          ? data
          : Array.isArray(data?.quizzes)
          ? data.quizzes
          : [];
        if (!cancel) setRows(list);
      } catch (e) {
        if (!cancel)
          setErr(
            e?.response?.data?.message || e.message || "Failed to load results"
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
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Results</h1>
        <Link
          to="/"
          className="inline-block rounded-md px-3 py-1 text-sm ring-1 ring-gray-300 hover:bg-gray-50"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {err && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      <section className="rounded-xl border bg-white p-4">
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-gray-600">No ended quizzes yet.</div>
        ) : (
          <ul className="divide-y">
            {rows.map((q) => (
              <li
                key={q._id}
                className="flex items-center justify-between py-3"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{q.title}</div>
                  <div className="truncate text-sm text-gray-600">
                    Topic: {q.topic || "—"}
                  </div>
                  <div className="text-xs text-gray-500">
                    Ended:{" "}
                    {q.endedAt ? new Date(q.endedAt).toLocaleString() : "—"}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <Link
                    to={`/t/results/${q._id}`}
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
