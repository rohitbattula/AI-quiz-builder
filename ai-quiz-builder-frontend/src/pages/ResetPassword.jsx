import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import api from "../lib/api";

export default function ResetPassword() {
  const [sp] = useSearchParams();
  const token = sp.get("token") || "";
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [err, setErr] = useState("");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // verify token on mount
  useEffect(() => {
    let cancel = false;
    (async () => {
      setChecking(true);
      setErr("");
      try {
        if (!token) {
          setErr("Missing reset token.");
          setValid(false);
          return;
        }
        const { data } = await api.get("/auth/verify-reset-token", {
          params: { token },
        });
        if (!cancel) setValid(!!data?.valid);
      } catch {
        if (!cancel) {
          setErr("Invalid or expired reset link.");
          setValid(false);
        }
      } finally {
        if (!cancel) setChecking(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [token]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setMsg("Password reset successful. Redirecting to login…");
      setTimeout(() => navigate("/login"), 1200);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-dvh grid place-items-center bg-gray-50">
        <div className="w-full max-w-md bg-white rounded-xl shadow p-6">
          <h2 className="text-2xl font-semibold">Reset Password</h2>
          <p className="text-sm text-gray-500 mt-2">
            Checking your reset link…
          </p>
        </div>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="min-h-dvh grid place-items-center bg-gray-50">
        <div className="w-full max-w-md bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="text-2xl font-semibold">Reset Password</h2>
          <p className="text-sm text-red-600">
            {err || "This reset link is invalid or has expired."}
          </p>
          <Link
            to="/forgot"
            className="text-indigo-600 hover:underline text-sm"
          >
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-gray-50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md bg-white rounded-xl shadow p-6 space-y-4"
      >
        <div className="text-center">
          <h2 className="text-2xl font-semibold">Choose a new password</h2>
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}
        {msg && <div className="text-sm text-green-700">{msg}</div>}

        <label className="text-sm">New password</label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <label className="text-sm">Confirm password</label>
        <input
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md py-2 font-medium outline-none ring-1 ring-gray-300 hover:bg-gray-50 active:scale-[.98]"
        >
          {loading ? "Resetting…" : "Reset password"}
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
