export function getPaging(req, { defaultLimit = 10, maxLimit = 50 } = {}) {
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(req.query.limit || defaultLimit, 10))
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function packPage({ items, total, page, limit }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    success: true,
    data: {
      items,
      page,
      pageSize: limit,
      total,
      totalPages,
    },
  };
}
