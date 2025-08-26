import jwt from "jsonwebtoken";

export function requireAuth(req, _res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : "";

  if (!token) {
    return next(
      Object.assign(new Error("missing token"), {
        status: 401,
      })
    );
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    next(
      Object.assign(new Error("invalid token"), {
        status: 401,
      })
    );
  }
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user)
      return next(Object.assign(new Error("Unauthenticated"), { status: 401 }));
    if (!roles.includes(req.user.role))
      return next(Object.assign(new Error("Forbidden"), { status: 403 }));
    next();
  };
}
