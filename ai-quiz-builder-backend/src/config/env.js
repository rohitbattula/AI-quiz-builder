import dotenv from "dotenv";
dotenv.config();

export const ENV = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? "4000"),
  MONGODB_URI: process.env.MONGODB_URI,
};

if (!ENV.MONGODB_URI) {
  console.error("mongodb uri is required");
  process.exit(1);
}
