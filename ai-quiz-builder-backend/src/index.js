import app from "./app.js";
import http from "http";
import { connectDB } from "./config/db.js";
import { ENV } from "./config/env.js";
import { initSocket } from "./socket/io.js";

async function bootstrap() {
  try {
    await connectDB();
    const server = http.createServer(app);

    const io = initSocket(server, {
      cors: {
        origin: process.env.CLIENT_ORIGIN?.split(",") || true,
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    app.set("io", io);
    server.listen(ENV.PORT, () => {
      console.log(`HTTP + Socket.IO running on :${ENV.PORT}`);
    });

    const shutdown = async (signal) => {
      console.log(`\n${signal} received. Shutting down...`);
      server.close(() => {
        console.log("🧹 HTTP server closed");
        process.exit(0);
      });
      // If something hangs, force-exit after a timeout
      setTimeout(() => process.exit(1), 10000).unref();
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (err) {
    console.error("❌ Failed to start app:", err);
    process.exit(1);
  }
}

bootstrap();
