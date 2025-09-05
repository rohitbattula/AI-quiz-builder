import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthProvider";

export default function StudentJoin() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [err, setErr] = useState("");

  async function handleJoin(e) {
    e.preventDefault();
    setErr("");

    const trimmed = code.trim();
    if (!trimmed) {
      setErr("Enter a join code.");
      return;
    }

    try {
      setJoining(true);
      const { data } = await api.post(
        `/quizzes/join/${encodeURIComponent(trimmed)}`,
        {}
      );
      // Expect the backend to return an id; try common shapes
      const quizId =
        data?.quizId || data?.quiz?._id || data?.quiz?.id || data?.data?.quizId;

      if (!quizId) {
        throw new Error("Joined, but quizId missing in response.");
      }

      // Go to student lobby
      nav(`/s/${quizId}`, { replace: true });
    } catch (e) {
      if (
        e?.response?.status === 409 &&
        e?.response?.data?.message === "quiz already written once"
      ) {
        setErr("Quiz already written once.");
      } else {
        setErr(e?.response?.data?.message || e.message || "Join failed");
      }
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="mx-auto max-w-lg px-4 py-5">
        <h1 className="text-xl font-semibold">Join a Quiz</h1>
        {user?.role !== "student" && (
          <p className="mt-1 text-xs text-amber-700">
            Note: this page is intended for students.
          </p>
        )}
      </header>

      <main className="mx-auto max-w-lg px-4">
        <form onSubmit={handleJoin} className="rounded-xl bg-white p-5 shadow">
          <label className="block text-sm font-medium mb-1">Join code</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="e.g., ABC123"
            value={code}
            onChange={(e) => setCode(e.target.value.toLowerCase())}
            autoFocus
          />

          {err && (
            <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {err}
            </div>
          )}

          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              disabled={joining}
              className="rounded-md px-4 py-2 text-sm ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-60"
            >
              {joining ? "Joining…" : "Join"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
