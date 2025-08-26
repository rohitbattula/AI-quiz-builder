import app from "./app.js";
import { connectDB } from "./config/db.js";
import { ENV } from "./config/env.js";

async function bootstrap() {
  try {
    await connectDB();
    const server = app.listen(ENV.PORT, () => {
      console.log(`server running at port $${ENV.PORT}`);
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
