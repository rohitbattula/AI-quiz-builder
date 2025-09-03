import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";

export default function Forgot() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      // Adjust the path if your backend uses a different endpoint (e.g., /auth/forgot).
      const { data } = await api.post("/auth/forgot-password", { email });
      setMsg(
        data?.message || "If that email exists, we’ve sent reset instructions."
      );
    } catch (e) {
      setErr(
        e?.response?.data?.message || e.message || "Failed to send reset email"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-gray-50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md bg-white rounded-xl shadow p-6 space-y-4"
      >
        <div className="text-center">
          <h2 className="text-2xl font-semibold">Forgot password</h2>
          <p className="text-sm text-gray-500">
            We’ll email you reset instructions
          </p>
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}
        {msg && <div className="text-sm text-green-700">{msg}</div>}

        <input
          className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <button
          className="w-full rounded-md py-2 font-medium outline-none ring-1 ring-gray-300 hover:bg-gray-50 active:scale-[.98]"
          disabled={loading}
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>

        <p className="text-sm text-gray-600 text-center">
          <Link to="/login" className="text-indigo-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
