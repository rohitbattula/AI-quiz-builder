import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

/**
 * Usage:
 * <Protected allow={["teacher"]}><CreateQuiz /></Protected>
 * - Redirects to /login if not authenticated
 * - If `allow` is provided, only those roles may pass; others go to "/"
 */
export default function Protected({ children, allow }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    // preserve where they were trying to go
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (allow && !allow.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
