import mongoose from "mongoose";

const participantSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },
    options: {
      type: [String],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length === 4,
        message: "give exactly 4 options",
      },
    },
    correctIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },
    points: {
      type: Number,
      default: 1,
      min: 1,
    },
    explanation: {
      type: String,
      default: "",
    },
  },
  {
    _id: true,
  }
);

const quizSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    durationSec: {
      type: Number,
      required: true,
      min: 30,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    joinCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    participants: { type: [participantSchema], default: [] },
    startedAt: { type: Date },
    endsAt: { type: Date },
    endedAt: { type: Date },

    status: {
      type: String,
      enum: ["draft", "active", "ended"],
      default: "draft",
    },
    questions: {
      type: [questionSchema],
      default: [],
    },
    aiSourceFiles: {
      type: [
        {
          originalName: String,
          mimeType: String,
          path: String,
          size: Number,
          uploadedAt: { type: Date, default: Date.now },
          uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        },
      ],
      default: [],
    },
    aiPromptNote: { type: String },
    numQuestions: { type: Number, default: 10, min: 1, max: 200 },
  },
  { timestamps: true }
);

quizSchema.methods.addParticipantOnce = function ({ userId }) {
  const exists = this.participants.some(
    (p) => String(p.user) === String(userId)
  );
  if (!exists) this.participants.push({ user: userId });
};

const Quiz = mongoose.model("Quiz", quizSchema);

export default Quiz;
