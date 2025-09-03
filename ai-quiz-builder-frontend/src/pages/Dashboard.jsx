import { useAuth } from "../context/AuthProvider";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="mx-auto max-w-6xl flex items-center justify-between px-4 py-4">
        <h1 className="text-xl font-semibold">AI Quiz Builder</h1>
        <div className="flex items-center gap-3">
          {!user ? (
            <Link
              to="/login"
              className="rounded-md px-3 py-1.5 text-sm ring-1 ring-gray-300 hover:bg-gray-100"
            >
              Login
            </Link>
          ) : (
            <button
              onClick={logout}
              className="rounded-md px-3 py-1.5 text-sm ring-1 ring-gray-300 hover:bg-gray-100"
            >
              Logout
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4">
        <section className="mt-6 rounded-xl bg-white p-6 shadow">
          <h2 className="text-lg font-semibold mb-1">Dashboard</h2>

          {!user ? (
            <p className="text-sm text-gray-700">
              You’re not logged in. Click{" "}
              <span className="font-medium">Login</span> to continue.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-700">
                Logged in as{" "}
                <span className="font-medium">{user?.name || user?.email}</span>{" "}
                ({user?.role || "user"}).
              </p>

              {/* Role-aware content */}
              {user?.role === "teacher" ? (
                <div className="mt-4 grid sm:grid-cols-2 gap-4">
                  <div className="rounded-lg border p-4">
                    <h3 className="font-medium">Create a Quiz</h3>
                    <p className="text-sm text-gray-500">
                      Start a new quiz for your class.
                    </p>
                    {/* Link these once routes are ready */}
                    {/* <Link to="/t/create" className="mt-3 inline-block rounded-md px-3 py-1.5 ring-1 ring-gray-300 hover:bg-gray-50">Open</Link> */}
                  </div>
                  <div className="rounded-lg border p-4">
                    <h3 className="font-medium">Manage Lobbies</h3>
                    <p className="text-sm text-gray-500">
                      See who joined and start/stop quizzes.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid sm:grid-cols-2 gap-4">
                  <div className="rounded-lg border p-4">
                    <h3 className="font-medium">Join a Quiz</h3>
                    <p className="text-sm text-gray-500">
                      Enter a join code from your teacher.
                    </p>
                    {/* <Link to="/join" className="mt-3 inline-block rounded-md px-3 py-1.5 ring-1 ring-gray-300 hover:bg-gray-50">Open</Link> */}
                  </div>
                  <div className="rounded-lg border p-4">
                    <h3 className="font-medium">My Attempts</h3>
                    <p className="text-sm text-gray-500">
                      View past scores and leaderboards.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
