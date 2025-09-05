import { useAuth } from "../context/AuthProvider";
import { Link } from "react-router-dom";

function CardLink({ to, title, desc }) {
  return (
    <Link
      to={to}
      className="block rounded-lg border p-4 hover:shadow-sm hover:ring-1 hover:ring-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2"
      role="button"
    >
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-gray-500">{desc}</p>
    </Link>
  );
}

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

              {user?.role === "teacher" ? (
                <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <CardLink
                    to="/create"
                    title="Create a Quiz"
                    desc="Start a new quiz for your class."
                  />
                  <CardLink
                    to="/lobbies"
                    title="Manage Lobbies"
                    desc="See participants and start/stop quizzes."
                  />
                  <CardLink
                    to="/t/results"
                    title="Check Results"
                    desc="View leaderboards and scores."
                  />
                </div>
              ) : (
                <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-2 gap-4">
                  <CardLink
                    to="/join"
                    title="Join a Quiz"
                    desc="Enter a join code from your teacher."
                  />
                  <CardLink
                    to="/marks"
                    title="My Marks"
                    desc="See your past attempts and scores."
                  />
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
