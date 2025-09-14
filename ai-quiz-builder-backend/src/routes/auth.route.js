import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { sendMail } from "../services/mail.js";
import crypto from "crypto";

const router = Router();

router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        message: "all fields are required",
      });
    }

    if (!["teacher", "student"].includes(role)) {
      return res.status(400).json({
        message: "role must be either teacher or student",
      });
    }

    const exist = await User.findOne({ email: email });
    if (exist) {
      return res.status(409).json({
        message: "email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash, role });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.status(201).json({
      token,
      user: {
        id: user._id,
        name,
        email,
        role,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const passwordCheck = await bcrypt.compare(password, user.passwordHash);
    if (!passwordCheck) {
      res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (e) {
    next(e);
  }
});

// post /api/auth/forgot-password {email}
router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email)
      return res.status(400).json({
        message: "email required",
      });

    const user = await User.findOne({ email: String(email).toLowerCase() });

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      user.resetPasswordToken = token;
      user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      const appUrl = process.env.APP_URL || "http://localhost:5173";
      const resetUrl = `${appUrl}/#/reset-password?token=${token}`;

      await sendMail({
        to: user.email,
        subject: "reset your AI quiz password",
        text: `reset your password: ${resetUrl}`,
        html: `
         <p>We received a request to reset your password.</p>
          <p><a href="${resetUrl}">Click here to reset it</a> (valid for 1 hour).</p>
          <p>If you didn’t request this, ignore this email.</p>
        `,
      });

      return res.json({
        success: true,
        message: "if the email exists, you will receive a reset link",
      });
    }
  } catch (e) {
    next(e);
  }
});

// GET /api/auth/verify-reset-token?token=...
router.get("/verify-reset-token", async (req, res, next) => {
  try {
    const { token } = req.query || {};
    if (!token) return res.status(400).json({ message: "token required" });

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    }).select("_id");

    return res.json({ valid: !!user });
  } catch (e) {
    next(e);
  }
});

// post /api/auth/reset-password
router.post("/reset-password", async (req, res, next) => {
  try {
    const { token, password } = req.body || {};

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }
    if (!token || !password) {
      return res.status(400).json({
        message: "token and password required",
      });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user)
      return res.status(400).json({
        message: "invalid token or token expired",
      });

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.passwordChangedAt = new Date();
    await user.save();

    return res.json({
      success: true,
      message: "password has been reset",
    });
  } catch (e) {
    next(e);
  }
});

export default router;
