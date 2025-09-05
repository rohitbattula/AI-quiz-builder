export default function Pagination({ page, totalPages, onPage }) {
  if (!totalPages || totalPages <= 1) return null;
  const prev = () => page > 1 && onPage(page - 1);
  const next = () => page < totalPages && onPage(page + 1);

  return (
    <div className="mt-4 flex items-center justify-center gap-2">
      <button
        onClick={prev}
        disabled={page <= 1}
        className="rounded-md px-3 py-1 text-sm ring-1 ring-gray-300 disabled:opacity-50"
      >
        Prev
      </button>
      <span className="text-sm">
        Page <span className="font-medium">{page}</span> of{" "}
        <span className="font-medium">{totalPages}</span>
      </span>
      <button
        onClick={next}
        disabled={page >= totalPages}
        className="rounded-md px-3 py-1 text-sm ring-1 ring-gray-300 disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}
