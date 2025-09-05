import { Router } from "express";
import Attempt from "../models/Attempt.js";
import Quiz from "../models/Quiz.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// GET /api/attempts/mine
router.get(
  "/mine",
  requireAuth,
  requireRole("student"),
  async (req, res, next) => {
    try {
      const userId = req.user.id;
      const attempts = await Attempt.find({ user: userId, status: "submitted" })
        .sort({ submittedAt: -1 })
        .populate({ path: "quiz", select: "title topic" })
        .lean();

      const out = attempts.map((a) => ({
        id: a._id,
        quizId: a.quiz?._id || a.quiz,
        quizTitle: a.quiz?.title || "",
        quizTopic: a.quiz?.topic || "",
        score: a.score ?? 0,
        maxScore: a.maxScore ?? a.totalPoints ?? 0,
        submittedAt: a.submittedAt || a.updatedAt || null,
      }));

      res.json({ success: true, attempts: out });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
