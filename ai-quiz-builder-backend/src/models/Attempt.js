import mongoose from "mongoose";

const answerSchema = new mongoose.Schema(
  {
    qIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    selectedIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    isCorrect: {
      type: Boolean,
      default: false,
    },
    pointsAwarded: {
      type: Number,
      default: 0,
      min: 0,
    },
    answeredAt: {
      type: Date,
      default: Date.now,
    },
    timesec: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const attemptSchema = new mongoose.Schema(
  {
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "submitted"],
      default: "active",
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    submittedAt: {
      type: Date,
    },
    answers: {
      type: [answerSchema],
      default: [],
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxScore: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// exactly one quiz per user
attemptSchema.index({ quiz: 1, user: 1 }, { unique: true });

attemptSchema.methods.addOrUpdateAnswer = function ({
  qIndex,
  selectedIndex,
  pointsPossible,
  correctIndex,
}) {
  const i = this.answers.findIndex((a) => a.qIndex === qIndex);
  const isCorrect = Number(selectedIndex) === Number(correctIndex);
  const pointsAwarded = isCorrect ? Number(pointsPossible || 1) : 0;
  const rec = {
    qIndex,
    selectedIndex,
    isCorrect,
    pointsAwarded,
    answeredAt: new Date(),
  };

  if (i === -1) this.answers.push(rec);
  else this.answers[i] = { ...this.answers[i], ...rec };
  this.score = this.answers.reduce((s, a) => s + (a.pointsAwarded || 0), 0);
};

const Attempt = mongoose.model("Attempt", attemptSchema);

export default Attempt;
