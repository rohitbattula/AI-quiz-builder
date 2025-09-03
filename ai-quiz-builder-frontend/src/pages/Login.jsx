import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login(email, password);
      nav("/"); // back to Dashboard – it will show role-based content
    } catch (e) {
      setErr(e.message || "Login failed");
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
          <h2 className="text-2xl font-semibold">Sign in</h2>
          <p className="text-sm text-gray-500">AI Quiz Builder</p>
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}

        <input
          className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <input
          className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        <button
          className="w-full rounded-md py-2 font-medium outline-none ring-1 ring-gray-300 hover:bg-gray-50 active:scale-[.98]"
          disabled={loading}
        >
          {loading ? "Signing in…" : "Login"}
        </button>

        <div className="flex items-center justify-between text-sm text-gray-600">
          <Link to="/forgot" className="text-indigo-600 hover:underline">
            Forgot password?
          </Link>
          <span>
            No account?{" "}
            <Link to="/register" className="text-indigo-600 hover:underline">
              Sign up
            </Link>
          </span>
        </div>
      </form>
    </div>
  );
}
