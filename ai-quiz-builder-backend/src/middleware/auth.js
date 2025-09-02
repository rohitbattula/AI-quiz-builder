import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function requireAuth(req, _res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : "";

  if (!token) {
    return next(Object.assign(new Error("Missing token"), { status: 401 }));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload?.id) {
      return next(
        Object.assign(new Error("Invalid token payload"), { status: 401 })
      );
    }

    // Ensure the account still exists; fetch fresh role & passwordChangedAt
    const user = await User.findById(payload.id).select(
      "role passwordChangedAt"
    );
    if (!user) {
      return next(
        Object.assign(new Error("Account not found"), { status: 401 })
      );
    }

    // Invalidate sessions issued before last password change
    if (user.passwordChangedAt) {
      const changed = Math.floor(user.passwordChangedAt.getTime() / 1000); // seconds
      if (payload.iat && payload.iat < changed) {
        return next(
          Object.assign(new Error("Session expired. Please log in again."), {
            status: 401,
          })
        );
      }
    }

    // Attach user with fresh role (prevents stale-role tokens)
    req.user = { ...payload, role: user.role };
    return next();
  } catch (e) {
    return next(Object.assign(new Error("Invalid token"), { status: 401 }));
  }
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(Object.assign(new Error("Unauthenticated"), { status: 401 }));
    }
    if (!roles.includes(req.user.role)) {
      return next(Object.assign(new Error("Forbidden"), { status: 403 }));
    }
    return next();
  };
}
