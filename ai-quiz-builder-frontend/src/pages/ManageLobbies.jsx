import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

function StatusPill({ status }) {
  const s = String(status || "").toLowerCase();
  const styles =
    s === "active"
      ? "bg-green-50 ring-green-200"
      : s === "ended"
      ? "bg-gray-50 ring-gray-200"
      : "bg-yellow-50 ring-yellow-200";
  return (
    <span className={`rounded px-2 py-0.5 text-xs ring-1 ${styles}`}>
      {s ? s.toUpperCase() : "—"}
    </span>
  );
}

function Notice({ type = "info", text, onClose }) {
  if (!text) return null;
  const color =
    type === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : type === "success"
      ? "border-green-200 bg-green-50 text-green-700"
      : "border-gray-200 bg-gray-50 text-gray-700";
  return (
    <div
      className={`mt-4 flex items-start justify-between rounded-md border px-3 py-2 text-sm ${color}`}
    >
      <span>{text}</span>
      <button
        onClick={onClose}
        className="ml-3 rounded px-2 py-0.5 text-xs ring-1 ring-gray-300 hover:bg-white/40"
      >
        Close
      </button>
    </div>
  );
}

export default function ManageLobbies() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [acting, setActing] = useState({}); // quizId -> "start" | "end" | "delete"
  const [confirmDeleteId, setConfirmDeleteId] = useState(""); // which quiz is confirming removal
  const [notice, setNotice] = useState({ type: "info", text: "" });

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        // Backend: quizzes I created where status != "ended"
        const { data } = await api.get("/quizzes/mine");
        if (!cancel) setRows(Array.isArray(data?.quizzes) ? data.quizzes : []);
      } catch (e) {
        if (!cancel)
          setError(e?.response?.data?.message || e.message || "Failed to load");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  function openLobby(quizId) {
    nav(`/t/${quizId}`);
  }

  async function doStart(quizId) {
    setActing((s) => ({ ...s, [quizId]: "start" }));
    try {
      await api.post(`/quizzes/${quizId}/start`, {});
      setRows((prev) =>
        prev.map((r) =>
          String(r._id || r.id) === String(quizId)
            ? { ...r, status: "active" }
            : r
        )
      );
      setNotice({ type: "success", text: "Quiz started." });
    } catch (e) {
      setNotice({
        type: "error",
        text: e?.response?.data?.message || e.message || "Failed to start",
      });
    } finally {
      setActing((s) => {
        const { [quizId]: _, ...rest } = s;
        return rest;
      });
    }
  }

  async function doEnd(quizId) {
    setActing((s) => ({ ...s, [quizId]: "end" }));
    try {
      await api.post(`/quizzes/${quizId}/end`, {});
      // remove ended since page only shows non-ended
      setRows((prev) =>
        prev.filter((r) => String(r._id || r.id) !== String(quizId))
      );
      setNotice({ type: "success", text: "Quiz ended." });
    } catch (e) {
      setNotice({
        type: "error",
        text: e?.response?.data?.message || e.message || "Failed to end",
      });
    } finally {
      setActing((s) => {
        const { [quizId]: _, ...rest } = s;
        return rest;
      });
    }
  }

  async function doDelete(quizId) {
    setActing((s) => ({ ...s, [quizId]: "delete" }));
    try {
      await api.delete(`/quizzes/${quizId}`);
      setRows((prev) =>
        prev.filter((r) => String(r._id || r.id) !== String(quizId))
      );
      setNotice({ type: "success", text: "Quiz removed." });
      setConfirmDeleteId("");
    } catch (e) {
      setNotice({
        type: "error",
        text: e?.response?.data?.message || e.message || "Failed to remove",
      });
    } finally {
      setActing((s) => {
        const { [quizId]: _, ...rest } = s;
        return rest;
      });
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Manage Lobbies</h1>
        <button
          onClick={() => window.location.reload()}
          className="rounded-md px-3 py-1.5 text-sm ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Notice
        type={notice.type}
        text={notice.text}
        onClose={() => setNotice({ type: "info", text: "" })}
      />

      <section className="mt-6">
        {loading ? (
          <div className="rounded-lg border bg-white p-6 text-sm text-gray-600">
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border bg-white p-6 text-sm text-gray-600">
            No draft/active quizzes yet. Create one to get started.
          </div>
        ) : (
          <ul className="grid gap-3">
            {rows.map((r) => {
              const id = r._id || r.id;
              const busy = acting[id];
              const canStart = r.status === "draft";
              const canEnd = r.status === "active";
              const canDelete = r.status === "draft"; // remove only before start
              const confirmThis = confirmDeleteId === String(id);

              return (
                <li key={id} className="rounded-lg border bg-white">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-medium">{r.title}</h3>
                        <StatusPill status={r.status} />
                      </div>
                      <p className="truncate text-sm text-gray-600">
                        Topic:{" "}
                        <span className="font-medium">{r.topic || "—"}</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        Join code:{" "}
                        <span className="rounded bg-gray-100 px-2 py-0.5">
                          {r.joinCode || "—"}
                        </span>
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {/* Remove Quiz — only for drafts */}
                      {canDelete && !confirmThis && (
                        <button
                          type="button"
                          title="Remove draft quiz"
                          onClick={() => setConfirmDeleteId(String(id))}
                          className="rounded-md px-3 py-1.5 text-xs ring-1 ring-red-300 hover:bg-red-50"
                        >
                          Remove Quiz
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openLobby(id)}
                        className="rounded-md px-3 py-1.5 text-xs ring-1 ring-gray-300 hover:bg-gray-50"
                      >
                        Open Lobby
                      </button>

                      <button
                        type="button"
                        onClick={() => doStart(id)}
                        disabled={!canStart || !!busy}
                        className="rounded-md px-3 py-1.5 text-xs ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {busy === "start" ? "Starting…" : "Start"}
                      </button>

                      <button
                        type="button"
                        onClick={() => doEnd(id)}
                        disabled={!canEnd || !!busy}
                        className="rounded-md px-3 py-1.5 text-xs ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {busy === "end" ? "Ending…" : "End"}
                      </button>
                    </div>
                  </div>

                  {/* Styled inline confirm area */}
                  {confirmThis && (
                    <div className="mx-4 mb-3 rounded-md border border-red-200 bg-red-50 p-3">
                      <p className="text-sm text-red-700">
                        Remove this quiz? This action can’t be undone.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => doDelete(id)}
                          disabled={busy === "delete"}
                          className="rounded-md px-3 py-1.5 text-xs ring-1 ring-red-300 hover:bg-white disabled:opacity-50"
                        >
                          {busy === "delete" ? "Removing…" : "Yes, remove"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId("")}
                          className="rounded-md px-3 py-1.5 text-xs ring-1 ring-gray-300 hover:bg-white"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
