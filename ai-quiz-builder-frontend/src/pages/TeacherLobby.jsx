import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { getSocket } from "../lib/socket";
import { useAuth } from "../context/AuthProvider";

function normId(p) {
  return (
    p?.userId ||
    p?.user?._id ||
    p?.user?.id ||
    p?.id ||
    p?._id ||
    String(Math.random())
  );
}
function normName(p) {
  return (
    p?.name ||
    p?.displayName ||
    p?.user?.name ||
    (p?.email ? String(p.email).split("@")[0] : "") ||
    "Unknown"
  );
}
function normOne(p) {
  return {
    userId: normId(p),
    name: normName(p),
    joinedAt: p?.joinedAt || p?.createdAt || null,
  };
}

export default function TeacherLobby() {
  const { quizId } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();

  const [meta, setMeta] = useState({
    title: "",
    topic: "",
    joinCode: "",
    status: "draft", // draft | active | ended
    startedAt: null,
    endsAt: null,
  });
  const [youAreOwner, setYouAreOwner] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(""); // "start" | "end" | ""

  // copy UI state
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);

  const refreshLobby = useCallback(async () => {
    const { data } = await api.get(`/quizzes/${quizId}/lobby`);
    const list = Array.isArray(data?.lobby?.participants)
      ? data.lobby.participants
      : Array.isArray(data?.participants)
      ? data.participants
      : [];
    setParticipants(list.map(normOne));
  }, [quizId]);

  // bootstrap + socket listeners
  useEffect(() => {
    let alive = true;
    const s = getSocket();

    (async () => {
      try {
        // Initial status: title/topic/joinCode/times
        const { data: st } = await api.get(`/quizzes/${quizId}/status`);
        if (!alive) return;

        setMeta((m) => ({
          ...m,
          title: st?.title || "",
          topic: st?.topic || "",
          joinCode: st?.joinCode || "",
          status: st?.status || "draft",
          startedAt: st?.startedAt || null,
          endsAt: st?.endsAt || null,
        }));

        // If it's already ended, bounce to dashboard
        if (st?.status === "ended") {
          nav("/", { replace: true });
          return;
        }

        // Join socket room
        s.emit("lobby:join", { quizId }, async (ack) => {
          if (!alive) return;
          if (ack?.ok) {
            const d = ack.data || {};
            setMeta((m) => ({
              ...m,
              title: d.title || m.title,
              topic: d.topic || m.topic,
              status: d.status || m.status,
              startedAt: d.startedAt || m.startedAt,
              endsAt: d.endsAt || m.endsAt,
            }));
            setYouAreOwner(Boolean(d.youAreOwner) || user?.role === "teacher");

            // Canonical list for correct names
            try {
              await refreshLobby();
            } catch {
              const fromAck = Array.isArray(d.participants)
                ? d.participants
                : [];
              setParticipants(fromAck.map(normOne));
            }
          }
          setLoading(false);
        });

        const onJoined = async (p) => {
          if (p.quizId !== quizId) return;
          // Refresh once to pick real name
          try {
            await refreshLobby();
          } catch {
            setParticipants((prev) => {
              const id = normId(p);
              if (prev.some((x) => String(x.userId) === String(id)))
                return prev;
              return [...prev, normOne(p)];
            });
          }
        };
        const onStarted = (msg) => {
          if (msg.quizId !== quizId) return;
          setMeta((m) => ({
            ...m,
            status: "active",
            startedAt: msg.startedAt,
            endsAt: msg.endsAt,
          }));
        };
        const onEnded = (msg) => {
          if (msg.quizId !== quizId) return;
          setMeta((m) => ({ ...m, status: "ended" }));
          // Navigate back to dashboard when the quiz ends (via socket)
          nav("/", { replace: true });
        };

        s.on("lobby:participant-joined", onJoined);
        s.on("quiz:started", onStarted);
        s.on("quiz:ended", onEnded);

        return () => {
          s.off("lobby:participant-joined", onJoined);
          s.off("quiz:started", onStarted);
          s.off("quiz:ended", onEnded);
        };
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [quizId, user?.role, refreshLobby, nav]);

  // If meta flips to ended for any reason, go home
  useEffect(() => {
    if (meta.status === "ended") {
      nav("/", { replace: true });
    }
  }, [meta.status, nav]);

  // clear copy timer on unmount
  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  async function startQuiz() {
    try {
      setActing("start");
      await api.post(`/quizzes/${quizId}/start`, {});
      setMeta((m) => ({ ...m, status: "active" })); // socket will confirm times
    } catch (e) {
      alert(e?.response?.data?.message || e.message || "Failed to start");
    } finally {
      setActing("");
    }
  }

  async function endQuiz() {
    try {
      setActing("end");
      await api.post(`/quizzes/${quizId}/end`, {});
      // Navigate immediately after ending from teacher side
      nav("/", { replace: true });
    } catch (e) {
      alert(e?.response?.data?.message || e.message || "Failed to end");
    } finally {
      setActing("");
    }
  }

  function copyJoin() {
    if (!meta.joinCode) return;
    try {
      navigator.clipboard?.writeText(String(meta.joinCode));
    } catch {}
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1500);
  }

  const canStart = youAreOwner && meta.status === "draft";
  const canEnd = youAreOwner && meta.status === "active";

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{meta.title || "Lobby"}</h1>
          <p className="text-sm text-gray-600">
            Topic: <span className="font-medium">{meta.topic || "—"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded px-2 py-1 text-xs ring-1">
            {String(meta.status || "").toUpperCase() || "—"}
          </span>
          {canStart && (
            <button
              onClick={startQuiz}
              disabled={acting === "start"}
              className="rounded-md px-3 py-1.5 text-sm ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              {acting === "start" ? "Starting…" : "Start Quiz"}
            </button>
          )}
          {canEnd && (
            <button
              onClick={endQuiz}
              disabled={acting === "end"}
              className="rounded-md px-3 py-1.5 text-sm ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              {acting === "end" ? "Ending…" : "End Now"}
            </button>
          )}
        </div>
      </header>

      <section className="mt-4 rounded-lg border bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="text-sm">
            Join code:{" "}
            <span className="rounded bg-gray-100 px-2 py-0.5 font-mono">
              {meta.joinCode || "—"}
            </span>
          </div>
          {meta.joinCode && (
            <button
              type="button"
              onClick={copyJoin}
              className={`rounded px-2 py-1 text-xs ring-1 ${
                copied
                  ? "ring-green-300 bg-green-50"
                  : "ring-gray-300 hover:bg-gray-50"
              }`}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          )}
          {/* screen-reader friendly live region */}
          <span className="sr-only" aria-live="polite">
            {copied ? "Join code copied" : ""}
          </span>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-medium mb-2">Participants</h2>
        <div className="rounded-lg border bg-white">
          {loading ? (
            <div className="p-4 text-sm text-gray-600">Joining lobby…</div>
          ) : participants.length === 0 ? (
            <div className="p-4 text-sm text-gray-600">
              Waiting for students to join…
            </div>
          ) : (
            <ul className="divide-y">
              {participants.map((p) => (
                <li
                  key={p.userId}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-gray-500">
                    {p.joinedAt
                      ? new Date(p.joinedAt).toLocaleTimeString()
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
