import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import healthRoute from "./routes/health.route.js";
import { notFound, errorHandler } from "./middleware/error.js";

import authRoute from "./routes/auth.route.js";

const app = express();

// Security & basics
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
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

// 404 + error
app.use(notFound);
app.use(errorHandler);

export default app;
