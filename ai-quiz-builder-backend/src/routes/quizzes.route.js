import fs from "fs";
import path from "path";
import multer from "multer";
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import Quiz from "../models/Quiz.js";
import { generateJoinCode } from "../utils/joinCode.js";
import { extractTextFromUploads } from "../services/ai/extract.js";
import {
  generateQuestions,
  validateAndShapeQuestions,
} from "../services/ai/gemini.js";

/*
 * POST /api/quizzes
 * Body:
 * {
 *   "title": "DSA Basics",
 *   "topic": "Arrays",
 *   "difficulty": "medium",
 *   "durationSec": 900,
 *   "questions": [
 *     { "text": "...", "options": ["A","B","C","D"], "correctIndex": 2, "points": 1 }
 *   ]
 * }
 */

const router = Router();

function maybeAutoExpire(quiz) {
  if (
    quiz.status == "active" &&
    quiz.endsAt &&
    Date.now() > quiz.endsAt.getTime()
  ) {
    quiz.status = "ended";
    quiz.endedAt = new Date();
  }
}

router.post(
  "/",
  requireAuth,
  requireRole("teacher"),
  async (req, res, next) => {
    try {
      const {
        title,
        topic,
        difficulty = "medium",
        durationSec,
        aiPromptNote,
        allowLateJoin = false,
      } = req.body;

      let { questions } = req.body;

      // required quiz fields
      if (!title || !topic || !durationSec) {
        return res
          .status(400)
          .json({ message: "title, topic, durationSec are required" });
      }

      // if sent via form-data, questions may be a string
      if (typeof questions === "string") {
        try {
          questions = JSON.parse(questions);
        } catch {
          return res
            .status(400)
            .json({ message: "questions must be a JSON array" });
        }
      }

      if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ message: "questions[] is required" });
      }

      // sanitize + validate with clear errors
      const sanitized = [];
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i] || {};
        const text = (q.text ?? "").toString().trim();
        const options = Array.isArray(q.options)
          ? q.options.map((o) => (o ?? "").toString())
          : [];
        const correctIndex = Number(q.correctIndex);
        const points =
          Number.isFinite(Number(q.points)) && Number(q.points) > 0
            ? Number(q.points)
            : 1;

        if (!text) {
          return res
            .status(400)
            .json({ message: `Invalid question at index ${i}: text required` });
        }
        if (options.length !== 4) {
          return res.status(400).json({
            message: `Invalid question at index ${i}: exactly 4 options required`,
          });
        }
        if (
          !Number.isInteger(correctIndex) ||
          correctIndex < 0 ||
          correctIndex > 3
        ) {
          return res.status(400).json({
            message: `Invalid question at index ${i}: correctIndex must be 0..3`,
          });
        }

        sanitized.push({
          text,
          options: options.slice(0, 4),
          correctIndex,
          points,
          explanation: (q.explanation ?? "").toString(),
        });
      }

      // join code creation (unchanged)
      let joinCode = generateJoinCode();
      for (let i = 0; i < 5; i++) {
        const exists = await Quiz.findOne({ joinCode });
        if (!exists) break;
        joinCode = generateJoinCode();
      }

      const quiz = await Quiz.create({
        title,
        topic,
        difficulty,
        durationSec,
        createdBy: req.user.id, // your JWT uses `id`
        joinCode,
        questions: sanitized, // <-- use sanitized, validated questions
        allowLateJoin,
        ...(aiPromptNote ? { aiPromptNote } : {}),
      });

      return res.status(201).json({ quiz });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * JOIN (student) — allowed when status is draft (pre-start) or active (late join OK)
 * POST /api/quizzes/join/:joinCode
 * body: (none needed)
 */

router.post("/join/:joinCode", requireAuth, async (req, res, next) => {
  try {
    const { joinCode } = req.params;
    const quiz = await Quiz.findOne({ joinCode });

    if (!quiz) {
      return res.status(404).json({
        message: "quiz not found",
      });
    }

    maybeAutoExpire(quiz);
    if (quiz.status == "ended") {
      if (quiz.isModified()) await quiz.save();
      return res.status(409).json({
        message: "quiz already ended",
      });
    }

    quiz.addParticipantOnce({ userId: req.user.id });
    await quiz.save();

    const io = req.app.get("io");
    io?.to(`room:quiz:${quiz._id}`).emit("lobby:participant-joined", {
      quizId: String(quiz._id),
      userId: String(req.user.id),
      name: req.user.name || req.user.email || "student",
      joinedAt: new Date(),
      count: quiz.participants.length,
    });

    return res.status(200).json({
      success: true,
      quiz: {
        id: quiz._id,
        title: quiz.title,
        topic: quiz.topic,
        status: quiz.status, // draft/active/ended
        durationSec: quiz.durationSec,
        startedAt: quiz.startedAt,
        endsAt: quiz.endsAt,
      },
    });
  } catch (e) {
    next(e);
  }
});

/**
 * LOBBY VIEW (teacher or participant)
 * GET /api/quizzes/:quizId/lobby
 * - No special status; when status=draft, it behaves like a waiting room.
 * - Uses populate to read participant names from User.
 */
router.get("/:quizId/lobby", requireAuth, async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId)
      .select(
        "title topic status participants startedAt endsAt durationSec createdBy owner"
      )
      .populate({ path: "participants.user", select: "name email" });

    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    const isOwner =
      String(quiz.createdBy || quiz.owner) === String(req.user.id);
    const isParticipant = quiz.participants.some(
      (p) => String(p.user?.id || p.user) === String(req.user.id)
    );
    if (!isOwner && !isParticipant && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not allowed" });
    }

    return res.json({
      success: true,
      lobby: {
        title: quiz.title,
        topic: quiz.topic,
        status: quiz.status, // draft/active/ended
        durationSec: quiz.durationSec,
        startedAt: quiz.startedAt,
        endsAt: quiz.endsAt,
        participants: quiz.participants.map((p) => ({
          user: p.user?.id || p.user,
          name: p.user?.name ?? "(no name)",
          joinedAt: p.joinedAt,
        })),
      },
    });
  } catch (e) {
    next(e);
  }
});

/**
 * START (teacher-owner only)
 * POST /api/quizzes/:quizId/start
 * body: { startInSec?: number }
 * Sets status=active, computes startedAt/endsAt
 */

router.post(
  "/:quizId/start",
  requireAuth,
  requireRole("teacher"),
  async (req, res, next) => {
    try {
      const quiz = await Quiz.findById(req.params.quizId);
      if (!quiz) {
        return res.status(404).json({
          message: "quiz not found",
        });
      }

      const ownerId = String(quiz.createdBy || quiz.owner);
      if (ownerId != String(req.user.id)) {
        return res.status(403).json({
          message: "only owner can start",
        });
      }

      maybeAutoExpire(quiz);
      if (quiz.status === "ended") {
        return res.status(409).json({ message: "Quiz already ended" });
      }
      if (quiz.status === "active") {
        return res.status(200).json({
          success: true,
          message: "Quiz already active",
          startedAt: quiz.startedAt,
          endsAt: quiz.endsAt,
        });
      }

      const now = new Date();
      const startInSec = Number(req.body?.startInSec || 0);
      const startedAt = new Date(
        now.getTime() + Math.max(0, startInSec) * 1000
      );
      const endsAt = new Date(startedAt.getTime() + quiz.durationSec * 1000);

      quiz.status = "active";
      quiz.startedAt = startedAt;
      quiz.endsAt = endsAt;
      await quiz.save();

      const io = req.app.get("io");
      io?.to(`room:quiz:${quiz._id}`).emit("quiz:started", {
        quizId: String(quiz._id),
        startedAt: quiz.startedAt,
        endsAt: quiz.endsAt,
        status: "active",
      });

      return res.status(200).json({ success: true, startedAt, endsAt });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * END (teacher-owner only) — force end
 * POST /api/quizzes/:quizId/end
 */

router.post(
  "/:quizId/end",
  requireAuth,
  requireRole("teacher"),
  async (req, res, next) => {
    try {
      const quiz = await Quiz.findById(req.params.quizId);
      if (!quiz) return res.status(404).json({ message: "Quiz not found" });

      const ownerId = String(quiz.createdBy || quiz.owner);
      if (ownerId !== String(req.user.id)) {
        return res
          .status(403)
          .json({ message: "Only the owner can end the quiz" });
      }

      maybeAutoExpire(quiz);
      if (quiz.status === "ended") {
        if (quiz.isModified()) await quiz.save();
        return res.status(200).json({
          success: true,
          message: "Quiz already ended",
          endedAt: quiz.endedAt,
        });
      }

      quiz.status = "ended";
      quiz.endedAt = new Date();
      await quiz.save();

      const io = req.app.get("io");
      io?.to(`room:quiz:${quiz._id}`).emit("quiz:ended", {
        quizId: String(quiz._id),
        endedAt: quiz.endedAt,
        status: "ended",
      });

      return res.status(200).json({ success: true, endedAt: quiz.endedAt });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * STATUS (any authed) — clients poll this to move from draft→active→ended
 * GET /api/quizzes/:quizId/status
 */
router.get("/:quizId/status", requireAuth, async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId).select(
      "status startedAt endsAt endedAt durationSec joinCode title topic"
    );

    if (!quiz) return res.status(404).json({ message: "Quiz not found" });

    maybeAutoExpire(quiz);
    if (quiz.isModified()) await quiz.save();

    return res.json({
      success: true,
      status: quiz.status, // draft/active/ended
      title: quiz.title,
      topic: quiz.topic,
      startedAt: quiz.startedAt,
      endsAt: quiz.endsAt,
      endedAt: quiz.endedAt,
      durationSec: quiz.durationSec,
      joinCode: quiz.joinCode,
    });
  } catch (err) {
    next(err);
  }
});

//AI routes
//ai uploads
const uploadDir =
  process.env.AI_UPLOAD_DIR || path.join(process.cwd(), "uploads", "ai");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

//AI generate: POST /api/quizzes/:quizId/ai/generate
router.post(
  "/:quizId/ai/generate",
  requireAuth,
  requireRole("teacher"),
  upload.array("files", 8),
  async (req, res, next) => {
    try {
      const quiz = await Quiz.findById(req.params.quizId);
      if (!quiz)
        return res.status(404).json({
          message: "quiz not found",
        });

      const ownerId = String(quiz.createdBy || quiz.owner);
      if (ownerId !== String(req.user.id)) {
        return res.status(403).json({
          message: "only the owner can generate questions",
        });
      }

      if (quiz.status !== "draft") {
        return res.status(409).json({
          message: "generate only when in draft",
        });
      }

      const files = req.files || [];
      let sourceText = "";
      if (files.length) {
        const meta = files.map((f) => ({
          originalName: f.originalname,
          mimeType: f.mimetype,
          path: f.path,
          size: f.size,
          uploadedBy: req.user.id,
        }));
        quiz.aiSourceFiles.push(...meta);
        sourceText = await extractTextFromUploads(files);
      }

      const targetCount = Number(quiz.numQuestions || 10);
      const { prompt, json } = await generateQuestions({
        topic: quiz.topic,
        title: quiz.title,
        difficulty: quiz.difficulty || "medium",
        numQuestions: targetCount,
        sourceText,
      });

      const questions = validateAndShapeQuestions(json, targetCount);

      quiz.questions = questions;
      quiz.aiPromptNote = prompt;
      await quiz.save();

      const io = req.app.get("io");
      io?.to(`room:quiz:${quiz._id}`).emit("ai:generated", {
        quizId: String(quiz._id),
        count: questions.length,
      });

      return res.status(200).json({
        success: true,
        message: "questions generated",
        count: questions.length,
        quizId: quiz._id,
      });
    } catch (e) {
      const status = Number(e.status) || 500;
      return res.status(status).json({
        message: e.message || "ai generation failed",
      });
    }
  }
);

export default router;
