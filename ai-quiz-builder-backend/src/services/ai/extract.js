import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const SUPPORTED = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

const MAX_FILES = 8;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_CHARS_PER_FILE = 200_000;
const MAX_CHARS_TOTAL = 1_000_000;

function normalize(txt) {
  return txt
    .replace(/\r/g, "\n") // unify line endings
    .replace(/[ \t]+/g, " ") // collapse runs of spaces/tabs
    .replace(/\n{3,}/g, "\n\n") // collapse 3+ newlines to 2
    .trim();
}

function truncate(txt, max) {
  if (!txt) return "";
  return txt.length > max ? txt.slice(0, max) : txt;
}

export async function extractTextFromUploads(files = []) {
  if (!Array.isArray(files) || files.length === 0) {
    throw Object.assign(new Error("No files provided"), { status: 400 });
  }
  if (files.length > MAX_FILES) {
    throw Object.assign(new Error(`Too many files (max ${MAX_FILES})`), {
      status: 413,
    });
  }

  let total = 0;
  const parts = [];

  for (const f of files) {
    if (!SUPPORTED.has(f.mimetype)) {
      throw Object.assign(new Error(`Unsupported file type: ${f.mimetype}`), {
        status: 415,
      });
    }
    if (f.size > MAX_FILE_SIZE) {
      throw Object.assign(new Error(`File too large: ${f.originalname}`), {
        status: 413,
      });
    }

    let text = "";
    try {
      if (f.mimetype === "application/pdf") {
        const data = await pdfParse(fs.readFileSync(f.path));
        text = data.text || "";
        if (!text.trim()) {
          throw Object.assign(
            new Error(`No extractable text in PDF: ${f.originalname}`),
            { status: 422, code: "EMPTY_PDF_TEXT" }
          );
        }
      } else {
        text = fs.readFileSync(f.path, "utf8");
      }
    } catch (e) {
      // bubble up with a friendly status if provided
      throw Object.assign(
        new Error(e.message || `Failed to read ${f.originalname}`),
        { status: e.status || 500 }
      );
    }

    text = normalize(text);
    text = truncate(text, MAX_CHARS_PER_FILE);

    if (total + text.length > MAX_CHARS_TOTAL) {
      const remaining = Math.max(0, MAX_CHARS_TOTAL - total);
      text = truncate(text, remaining);
    }
    total += text.length;

    parts.push(`--- ${f.originalname} ---\n${text}`);
    if (total >= MAX_CHARS_TOTAL) break;
  }

  if (total === 0) {
    throw Object.assign(new Error("No usable text extracted from files"), {
      status: 422,
    });
  }

  return parts.join("\n\n");
}
