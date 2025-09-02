import "dotenv/config";
import nodemailer from "nodemailer";

const {
  SMTP_HOST,
  SMTP_PORT = 587,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM = "AI Quiz <no-reply@aiquiz.local>",
} = process.env;

// ❗ No dev fallback: fail if not configured
if (!SMTP_HOST) {
  throw new Error(
    "SMTP not configured. Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS in .env"
  );
}

export const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: Number(SMTP_PORT) === 465, // SSL only for 465
  auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
});

export async function sendMail({ to, subject, html, text }) {
  return transporter.sendMail({ from: MAIL_FROM, to, subject, text, html });
}
