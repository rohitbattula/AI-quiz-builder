import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import healthRoute from "./routes/health.route.js";
import { notFound, errorHandler } from "./middleware/error.js";

import authRoute from "./routes/auth.route.js";
import quizzesRoute from "./routes/quizzes.route.js";
import aiRouter from "./routes/ai.route.js";
import attemptsRouter from "./routes/attempts.route.js";

const app = express();

// Security & basics
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN?.split(",") || true,
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan("dev"));

// Basic rate limit (tweak later)
app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
  })
);

// Routes
app.use("/api/health", healthRoute);
app.use("/api/auth", authRoute);
app.use("/api/quizzes", quizzesRoute);
app.use("/api/ai", aiRouter);
app.use("/api/attempts", attemptsRouter);

// 404 + error
app.use(notFound);
app.use(errorHandler);

export default app;
