import mongoose from "mongoose";
import { ENV } from "./env.js";

export async function connectDB() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(ENV.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  });
}

console.log("db connected successfully");

const shutdown = async (signal) => {
  console.log(`${signal} received, closing db connection`);
  await mongoose.connection.close();
  console.log("connection closed");
  process.exit(0);
};

process.on("SIGINT", () => {
  shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});
