import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { getSocket } from "../lib/socket";

export default function StudentLobby() {
  const { quizId } = useParams();
  const nav = useNavigate();

  const [meta, setMeta] = useState({
    title: "",
    topic: "",
    status: "draft", // draft | active | ended
    startedAt: null,
    endsAt: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const s = getSocket();

    (async () => {
      try {
        // Initial details
        const { data: st } = await api.get(`/quizzes/${quizId}/status`);
        if (cancelled) return;

        // If already active, jump straight to play
        if (st?.status === "active") {
          nav(`/play/${quizId}`, { replace: true });
          return;
        }

        setMeta({
          title: st?.title || "",
          topic: st?.topic || "",
          status: st?.status || "draft",
          startedAt: st?.startedAt || null,
          endsAt: st?.endsAt || null,
        });

        // Join room for realtime start/end
        s.emit("lobby:join", { quizId }, () => {});

        const onStarted = (msg) => {
          if (msg.quizId !== quizId) return;
          // Navigate immediately when started
          nav(`/play/${quizId}`, { replace: true });
        };
        const onEnded = (msg) => {
          if (msg.quizId !== quizId) return;
          setMeta((m) => ({ ...m, status: "ended" }));
        };

        s.on("quiz:started", onStarted);
        s.on("quiz:ended", onEnded);

        setLoading(false);

        return () => {
          s.off("quiz:started", onStarted);
          s.off("quiz:ended", onEnded);
        };
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [quizId, nav]);

  const waiting = meta.status === "draft";
  const active = meta.status === "active";
  const ended = meta.status === "ended";

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {meta.title || "Quiz Lobby"}
          </h1>
          <p className="text-sm text-gray-600">
            Topic: <span className="font-medium">{meta.topic || "—"}</span>
          </p>
        </div>
        {/* Show status badge only after start or when ended — never show DRAFT */}
        {(active || ended) && (
          <span className="rounded px-2 py-1 text-xs ring-1">
            {String(meta.status).toUpperCase()}
          </span>
        )}
      </header>

      <section className="mt-6 rounded-lg border bg-white p-4">
        {loading ? (
          <p className="text-sm text-gray-600">Connecting…</p>
        ) : waiting ? (
          <div>
            <p className="text-base font-medium">
              Please wait for your teacher to start the quiz.
            </p>
            <p className="mt-1 text-sm text-gray-600">
              You’re all set — once the teacher starts, your quiz will begin
              automatically.
            </p>
          </div>
        ) : active ? (
          <div>
            <p className="text-base font-medium">The quiz has started!</p>
            <p className="mt-1 text-sm text-gray-600">
              Follow your teacher’s instructions. (Question screen comes next.)
            </p>
          </div>
        ) : ended ? (
          <div>
            <p className="text-base font-medium">This quiz has ended.</p>
            <button
              className="mt-3 rounded-md px-3 py-1.5 text-sm ring-1 ring-gray-300 hover:bg-gray-50"
              onClick={() => nav("/")}
            >
              Back to Dashboard
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
