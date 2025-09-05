import { Router } from "express";
import Attempt from "../models/Attempt.js";
import Quiz from "../models/Quiz.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getPaging, packPage } from "../utils/paginate.js";

const router = Router();

// GET /api/attempts/mine
router.get(
  "/mine",
  requireAuth,
  requireRole("student"),
  async (req, res, next) => {
    try {
      const { page, limit, skip } = getPaging(req, { defaultLimit: 10 });

      const base = { user: req.user.id, status: "submitted" }; // only submitted attempts in marks
      const [attempts, total] = await Promise.all([
        Attempt.find(base)
          .sort({ submittedAt: -1 })
          .select("_id quiz score maxScore totalPoints submittedAt")
          .populate({ path: "quiz", select: "title topic" })
          .skip(skip)
          .limit(limit)
          .lean(),
        Attempt.countDocuments(base),
      ]);

      const items = attempts.map((a) => ({
        id: a._id,
        quizId: a.quiz?._id,
        quizTitle: a.quiz?.title,
        quizTopic: a.quiz?.topic,
        score: a.score,
        maxScore: a.maxScore ?? a.totalPoints,
        submittedAt: a.submittedAt,
      }));

      return res.json(packPage({ items, total, page, limit }));
    } catch (e) {
      next(e);
    }
  }
);

export default router;
