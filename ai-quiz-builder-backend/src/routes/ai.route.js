import { Router } from "express";
import multer from "multer";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  generateQuestions,
  validateAndShapeQuestions,
} from "../services/ai/gemini.js";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

const router = Router();

// Memory uploads (no files written to disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per file
});

const SUPPORTED = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);

const MAX_FILES = 8;
const MAX_CHARS_PER_FILE = 200_000;
const MAX_CHARS_TOTAL = 400_000;

function normalize(txt) {
  return txt
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncate(txt, max) {
  if (!txt) return "";
  return txt.length > max ? txt.slice(0, max) : txt;
}

async function extractFromMemoryFiles(files = []) {
  if (!files?.length) return ""; // files optional

  if (files.length > MAX_FILES) {
    const err = new Error(`Too many files (max ${MAX_FILES})`);
    err.status = 413;
    throw err;
  }

  let total = 0;
  const parts = [];

  for (const f of files) {
    if (!SUPPORTED.has(f.mimetype)) {
      const err = new Error(`Unsupported file type: ${f.mimetype}`);
      err.status = 415;
      throw err;
    }

    let text = "";
    try {
      if (f.mimetype === "application/pdf") {
        const data = await pdfParse(f.buffer);
        text = data.text || "";
        if (!text.trim()) {
          const err = new Error(
            `No extractable text in PDF: ${f.originalname}`
          );
          err.status = 422; // scanned or image-only PDF
          throw err;
        }
      } else {
        text = f.buffer.toString("utf8");
      }
    } catch (e) {
      const err = new Error(e.message || `Failed to read ${f.originalname}`);
      err.status = e.status || 500;
      throw err;
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

  return parts.join("\n\n");
}

/**
 * POST /api/ai/quizzes/generate
 * Auth: teacher
 * Body: multipart/form-data
 *   fields: title, topic, difficulty, numQuestions
 *   files: files[] (optional, PDF/text)
 * Returns: { success, questions[], count, aiPromptNote }
 */
router.post(
  "/quizzes/generate",
  requireAuth,
  requireRole("teacher"),
  upload.array("files", MAX_FILES),
  async (req, res) => {
    try {
      const { title, topic, difficulty = "medium" } = req.body;
      const numQuestions = Math.min(
        Math.max(1, Number(req.body?.numQuestions || 10)),
        200
      );

      if (!title || !topic) {
        return res
          .status(400)
          .json({ message: "title and topic are required" });
      }

      const files = req.files || [];
      const sourceText = await extractFromMemoryFiles(files);

      const { prompt, json } = await generateQuestions({
        topic,
        title,
        difficulty,
        numQuestions,
        sourceText, // may be ""
      });

      const questions = validateAndShapeQuestions(json, numQuestions);

      return res.status(200).json({
        success: true,
        count: questions.length,
        questions,
        aiPromptNote: prompt, // send back so the client can store it on create
      });
    } catch (e) {
      const status = Number(e.status) || 500;
      return res
        .status(status)
        .json({ message: e.message || "Generation failed" });
    }
  }
);

export default router;
