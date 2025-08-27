import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import Quiz from "../models/Quiz.js";
import { generateJoinCode } from "../utils/joinCode.js";

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
        questions,
      } = req.body;

      if (!title || !topic || !durationSec) {
        return res
          .status(400)
          .json({ message: "title, topic, durationSec are required" });
      }
      if (!Array.isArray(questions) || questions.length === 0) {
        return res
          .status(400)
          .json({ message: "questions[] is required (manual mode for now)" });
      }

      for (const q of questions) {
        if (
          !q?.text ||
          !Array.isArray(q.options) ||
          q.options.length < 2 ||
          typeof q.correctIndex !== "number" ||
          q.correctIndex < 0 ||
          q.correctIndex >= q.options.length
        ) {
          return res.status(400).json({ message: "Invalid question format" });
        }
        q.points = Number.isFinite(q.points) ? q.points : 1;
        q.explanation = q.explanation ?? "";
      }

      //joincode creation
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
        createdBy: req.user.id,
        joinCode,
        questions,
      });

      return res.status(201).json({ quiz });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
