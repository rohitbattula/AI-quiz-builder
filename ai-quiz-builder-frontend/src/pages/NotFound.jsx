import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex h-[80vh] items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-800 dark:text-gray-100">
          404
        </h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Oops! The page you’re looking for doesn’t exist.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-md px-4 py-2 text-sm font-medium ring-1 ring-gray-300 hover:bg-gray-50"
        >
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
