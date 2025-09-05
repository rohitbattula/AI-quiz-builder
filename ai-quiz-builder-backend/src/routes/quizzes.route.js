import fs from "fs";
import path from "path";
import multer from "multer";
import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import Quiz from "../models/Quiz.js";
import Attempt from "../models/Attempt.js";
import { generateJoinCode } from "../utils/joinCode.js";
import { extractTextFromUploads } from "../services/ai/extract.js";
import {
  generateQuestions,
  validateAndShapeQuestions,
} from "../services/ai/gemini.js";
import { getPaging, packPage } from "../utils/paginate.js";

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

async function finalizeAttemptsForQuiz(quiz, io) {
  const now = new Date();
  await Attempt.updateMany(
    {
      quiz: quiz._id,
      status: "active",
    },
    {
      $set: {
        status: "submitted",
        submittedAt: now,
      },
    }
  );
  io?.to(`room:quiz:${quiz._id}`).emit("quiz:finalized", {
    quizId: String(quiz._id),
  });
}

function computeScore(quiz, attempt) {
  const qs = quiz?.questions || [];
  const a = attempt?.answers || attempt?.responses || [];
  let score = 0,
    totalPoints = 0,
    correctCount = 0;
  // build map: qIndex -> selectedIndex
  const byIndex = new Map();
  for (const item of a) {
    if (typeof item.qIndex === "number")
      byIndex.set(item.qIndex, item.selectedIndex);
    if (typeof item.questionIndex === "number")
      byIndex.set(item.questionIndex, item.selectedIndex);
  }
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i] || {};
    const pts = Number(q.points || 1);
    totalPoints += pts;
    const sel = byIndex.has(i) ? byIndex.get(i) : null;
    if (sel === q.correctIndex) {
      score += pts;
      correctCount += 1;
    }
  }
  return { score, totalPoints, correctCount };
}

/**
 * GET /api/quizzes/mine?status=ended
 * Add status filter support: "ended" returns only ended; default returns non-ended as you had.
 */
router.get(
  "/mine",
  requireAuth,
  requireRole("teacher"),
  async (req, res, next) => {
    try {
      const { status } = req.query; // optional
      const { page, limit, skip } = getPaging(req, { defaultLimit: 10 });

      const q = { createdBy: req.user.id };
      if (status) q.status = status;

      const [items, total] = await Promise.all([
        Quiz.find(q)
          .sort({ endedAt: -1, createdAt: -1 })
          .select(
            "_id title topic joinCode status startedAt endsAt endedAt participants"
          )
          .skip(skip)
          .limit(limit)
          .lean(),
        Quiz.countDocuments(q),
      ]);

      return res.json(packPage({ items, total, page, limit }));
    } catch (e) {
      next(e);
    }
  }
);

/**
 * GET /api/quizzes/:quizId/attempts/me
 * Student's own result for this quiz.
 */
router.get("/:quizId/attempts/me", requireAuth, async (req, res, next) => {
  try {
    const { quizId } = req.params;
    const quiz = await Quiz.findById(quizId).select("title topic").lean();
    if (!quiz) return res.status(404).json({ message: "quiz not found" });

    const a = await Attempt.findOne({
      quiz: quizId,
      user: req.user.id,
      status: "submitted",
    })
      .sort({ submittedAt: -1 })
      .lean();
    if (!a) return res.status(404).json({ message: "attempt not found" });

    return res.json({
      success: true,
      quiz: { id: quizId, title: quiz.title, topic: quiz.topic },
      attempt: {
        id: a._id,
        score: a.score ?? 0,
        maxScore: a.maxScore ?? a.totalPoints ?? 0,
        submittedAt: a.submittedAt || a.updatedAt || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/quizzes/:quizId/results
 * Teacher leaderboard for this quiz (must be owner).
 */
router.get(
  "/:quizId/results",
  requireAuth,
  requireRole("teacher"),
  async (req, res, next) => {
    try {
      const { quizId } = req.params;
      const owner = req.user._id || req.user.id;
      const { page, limit, skip } = getPaging(req, { defaultLimit: 10 });

      const quiz = await Quiz.findById(quizId).lean();
      if (!quiz) return res.status(404).json({ message: "quiz not found" });
      if (String(quiz.createdBy) !== String(owner)) {
        return res.status(403).json({ message: "not your quiz" });
      }

      const base = { quiz: quizId, status: "submitted" };
      const [attempts, total] = await Promise.all([
        Attempt.find(base)
          .populate({ path: "user", select: "name email" })
          .sort({ submittedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Attempt.countDocuments(base),
      ]);

      const items = attempts.map((a) => {
        const s =
          typeof a.score === "number" && typeof a.totalPoints === "number"
            ? {
                score: a.score,
                totalPoints: a.totalPoints,
                correctCount: a.correctCount || 0,
              }
            : computeScore(quiz, a);
        return {
          name: a.user?.name || "",
          email: a.user?.email || "",
          score: s.score,
          totalPoints: s.totalPoints,
          correctCount: s.correctCount,
          submittedAt: a.submittedAt || a.updatedAt || null,
        };
      });

      return res.json({
        success: true,
        quiz: { id: quiz._id, title: quiz.title, topic: quiz.topic },
        ...packPage({ items, total, page, limit }).data, // merge pagination fields at top level
      });
    } catch (err) {
      next(err);
    }
  }
);

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
      return res.status(404).json({ message: "quiz not found" });
    }

    // late-join check
    if (quiz.status === "active" && !quiz.allowLateJoin) {
      return res.status(409).json({ message: "quiz already started" });
    }

    // auto-expire, then check ended
    maybeAutoExpire(quiz);
    if (quiz.status === "ended") {
      if (quiz.isModified()) await quiz.save();
      return res.status(409).json({ message: "quiz already ended" });
    }

    // ⬇️ NEW: block re-join if already submitted this quiz
    const userId = req.user.id || req.user._id;
    const prior = await Attempt.findOne({
      quiz: quiz._id,
      user: userId,
      $or: [{ status: "submitted" }, { submittedAt: { $ne: null } }],
    }).lean();

    if (prior) {
      return res.status(409).json({
        message: "quiz already written once",
        code: "ALREADY_SUBMITTED",
      });
    }
    // ⬆️ END NEW

    // add as participant (idempotent)
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
      if (!quiz) {
        return res.status(404).json({
          message: "quiz not found",
        });
      }

      const ownerId = String(quiz.createdBy || quiz.owner);
      if (ownerId != String(req.user.id)) {
        return res.status(403).json({
          message: "only owner can end",
        });
      }

      if (quiz.status === "ended") {
        return res.status(200).json({
          success: true,
          message: "Quiz already ended",
          endedAt: quiz.endedAt,
        });
      }

      // mark as ended now
      const now = new Date();
      quiz.status = "ended";
      quiz.endedAt = now;
      await quiz.save();

      const io = req.app.get("io");
      io?.to(`room:quiz:${quiz._id}`).emit("quiz:ended", {
        quizId: String(quiz._id),
        endedAt: quiz.endedAt,
        status: "ended",
      });

      return res.status(200).json({ success: true, endedAt: quiz.endedAt });
    } catch (e) {
      next(e);
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

    const was = quiz.status;
    maybeAutoExpire(quiz);
    if (quiz.status === "ended" && was !== "ended") {
      await quiz.save();
      const io = req.app.get("io");
      await finalizeAttemptsForQuiz(quiz, io);
      io?.to(`room:quiz:${quiz._id}`).emit("quiz:ended", {
        quizId: String(quiz._id),
        endedAt: quiz.endedAt,
      });
    }

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

// get /api/quizzes/:quizId/questions
router.get("/:quizId/questions", requireAuth, async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz)
      return res.status(404).json({
        message: "quiz not found",
      });

    const isOwner =
      String(quiz.createdBy || quiz.owner) === String(req.user.id);
    const isParticipant = quiz.participants?.some(
      (p) => String(p.user?._id || p.user) === String(req.user.id) || false
    );

    if (!isOwner && !isParticipant && req.user.role !== "admin") {
      return res.status(403).json({
        message: "not allowed",
      });
    }

    if (quiz.status === "draft" && !isOwner) {
      return res.status(409).json({
        message: "quiz not started yet",
      });
    }

    const questions = (quiz.questions || []).map((q) => ({
      text: q.text,
      options: q.options,
      points: q.points ?? 1,
    }));

    res.json({ success: true, questions });
  } catch (e) {
    next(e);
  }
});

// post api/quizzes/:quizId/attempts/start
router.post("/:quizId/attempts/start", requireAuth, async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz)
      return res.status(404).json({
        message: "quiz not found",
      });

    maybeAutoExpire(quiz);
    if (quiz.status !== "active") {
      return res.status(409).json({
        message: "quiz is not active",
      });
    }

    if (
      !quiz.participants?.some((p) => String(p.user) === String(req.user.id))
    ) {
      quiz.participants = quiz.participants || [];
      quiz.participants.push({ user: req.user.id, joinedAt: new Date() });
      await quiz.save();
    }

    const maxScore = (quiz.questions || []).reduce(
      (s, q) => s + (Number(q.points) || 1),
      0
    );
    let attempt = await Attempt.findOne({ quiz: quiz._id, user: req.user.id });

    if (!attempt) {
      attempt = await Attempt.create({
        quiz: quiz._id,
        user: req.user.id,
        maxScore,
      });
    }

    res.status(201).json({
      success: true,
      attemptId: attempt._id,
      startedAt: attempt.startedAt,
      endsAt: quiz.endsAt,
    });
  } catch (e) {
    if (e?.code === 11000) {
      const retry = await Attempt.findOne({
        quiz: req.params.quizId,
        user: req.user.id,
      });
      return res.status(200).json({
        success: true,
        attemptId: retry._id,
        startedAt: retry.startedAt,
        endsAt: (await Quiz.findById(req.params.quizId))?.endsAt,
      });
    }
    next(e);
  }
});

// post /api/quizzes/:quizId/answers  body: {qIndex, selectedIndex}
router.post("/:quizId/answers", requireAuth, async (req, res, next) => {
  try {
    const { qIndex, selectedIndex } = req.body || {};
    if (!Number.isInteger(qIndex) || !Number.isInteger(selectedIndex)) {
      return res.status(400).json({
        message: "qindex and selectedIndex are required",
      });
    }

    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz)
      return res.status(404).json({
        message: "quiz not found",
      });

    maybeAutoExpire(quiz);
    if (quiz.status !== "active") {
      return res.status(409).json({
        message: "quiz not active",
      });
    }

    const attempt = await Attempt.findOne({
      quiz: quiz._id,
      user: req.user.id,
    });
    if (!attempt || attempt.status !== "active") {
      return res.status(404).json({
        message: "attempt not active",
      });
    }

    const q = (quiz.questions || [])[qIndex];
    if (selectedIndex < 0 || selectedIndex >= q.options.length) {
      return res.status(400).json({ message: "selectedIndex out of range" });
    }

    if (!q) {
      return res.status(400).json({
        message: "invalid qIndex",
      });
    }

    attempt.addOrUpdateAnswer({
      qIndex,
      selectedIndex,
      pointsPossible: q.points || 1,
      correctIndex: q.correctIndex,
    });

    await attempt.save();

    const io = req.app.get("io");
    io?.to(`room:quiz:${quiz._id}`).emit("answer:submitted", {
      quizId: String(quiz._id),
      userId: String(req.user.id),
      qIndex,
      score: attempt.score,
    });

    res.json({
      success: true,
      score: attempt.score,
    });
  } catch (e) {
    next(e);
  }
});

// post /api/quizzes/:quizId/submit
router.post("/:quizId/submit", requireAuth, async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz)
      return res.status(404).json({
        message: "quiz not found",
      });

    const attempt = await Attempt.findOne({
      quiz: quiz._id,
      user: req.user.id,
    });
    if (!attempt)
      return res.status(404).json({
        message: "attempt not found",
      });

    if (attempt.status === "submitted") {
      return res.json({
        success: true,
        score: attempt.score,
        maxScore: attempt.maxScore,
      });
    }

    attempt.status = "submitted";
    attempt.submittedAt = new Date();
    await attempt.save();

    const io = req.app.get("io");
    io?.to(`room:quiz:${quiz._id}`).emit("attempt:submitted", {
      quizId: String(quiz._id),
      userId: String(req.user.id),
      score: attempt.score,
      maxScore: attempt.maxScore,
    });

    res.json({
      success: true,
      score: attempt.score,
      maxScore: attempt.maxScore,
    });
  } catch (e) {
    next(e);
  }
});

//get /api/quizzes/:quizId/leaderboard
router.get("/:quizId/leaderboard", requireAuth, async (req, res, next) => {
  try {
    const quiz = await Quiz.findById(req.params.quizId);
    if (!quiz)
      return res.status(404).json({
        message: "quiz not found",
      });

    const attempts = await Attempt.find({ quiz: quiz._id })
      .populate("user", "name email")
      .sort({ score: -1, submittedAt: 1, startedAt: 1 })
      .limit(200);

    res.json({
      success: true,
      leaderboard: attempts.map((a) => ({
        user: a.user?._id,
        name: a.user?.name || a.user?.email,
        score: a.score,
        maxScore: a.maxScore,
        status: a.status,
        submittedAt: a.submittedAt,
      })),
    });
  } catch (e) {
    next(e);
  }
});

router.get(
  "/mine",
  requireAuth,
  requireRole("teacher"),
  async (req, res, next) => {
    try {
      const ownerId = req.user.id || req.user._id;
      const quizzes = await Quiz.find({
        createdBy: ownerId,
        status: { $ne: "ended" },
      })
        .sort({ createdAt: -1 })
        .select(
          "title topic status durationSec joinCode startedAt endsAt createdAt"
        );

      res.json({ quizzes });
    } catch (e) {
      next(e);
    }
  }
);

router.delete(
  "/:quizId",
  requireAuth,
  requireRole("teacher"),
  async (req, res, next) => {
    try {
      const { quizId } = req.params;
      const ownerId = req.user.id || req.user._id;

      const quiz = await Quiz.findOne({ _id: quizId, createdBy: ownerId });
      if (!quiz) {
        return res
          .status(404)
          .json({ success: false, message: "Quiz not found" });
      }

      if (quiz.status !== "draft") {
        return res.status(400).json({
          success: false,
          message: "Only draft quizzes can be deleted",
        });
      }

      // Defensive cleanup
      await Attempt.deleteMany({ quiz: quiz._id });
      await quiz.deleteOne();

      return res.json({ success: true, deletedId: quizId });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
