export function notFound(req, res, next) {
  res.status(400).json({
    success: false,
    message: "route not found",
  });
}

export function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;

  res.status(status).json({
    success: false,
    message: err.message || "internal server error",
  });
}
