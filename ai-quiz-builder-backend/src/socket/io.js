import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import Quiz from "../models/Quiz.js";

const roomForQuiz = (quizId) => `room:quiz:${quizId}`;

function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("jwt secret not set");
  return jwt.verify(token, secret);
}

export function initSocket(server, ioOptions = {}) {
  const io = new Server(server, ioOptions);

  //auth
  io.use((socket, next) => {
    try {
      const bearer = socket.handshake.headers?.authorization || "";
      const token =
        socket.handshake.auth?.token ||
        (bearer.startsWith("Bearer ") ? bearer.slice(7) : "");
      if (!token) return next(new Error("unauthenticated"));

      const payload = verifyToken(token);
      socket.data.userId = payload._id || payload.id;
      socket.data.role = payload.role;
      socket.data.name = payload.name;
      next();
    } catch {
      next(new Error("unauthenticated"));
    }
  });

  //connection
  io.on(connection, (socket) => {
    socket.on("lobby:join", async (payload = {}, ack) => {
      try {
        const { quizId } = payload || {};
        if (!quizId)
          return ack?.({
            ok: false,
            error: {
              code: "BAD_REQUEST",
              message: "quizId required",
            },
          });

        const quiz = await Quiz.findById(quizId)
          .select(
            "title topic status durationSec startedAt endsAt owner createdBy participants"
          )
          .populate({ path: "participants.user", select: "name" });

        if (!quiz)
          return ack?.({
            ok: false,
            error: { code: "NOT_FOUND", message: "Quiz not found" },
          });

        const isOwner =
          String(quiz.owner || quiz.createdBy) === String(socket.data.userId);
        const isParticipant = quiz.participants.some(
          (p) => String(p.user?._id || p.user) === String(socket.data.userId)
        );
        if (!isOwner && !isParticipant && socket.data.role !== "admin") {
          return ack?.({
            ok: false,
            error: { code: "FORBIDDEN", message: "Not allowed" },
          });
        }

        socket.join(roomForQuiz(quizId));

        ack?.({
          ok: true,
          data: {
            quizId: String(quizId),
            title: quiz.title,
            topic: quiz.topic,
            status: quiz.status, // draft|active|ended
            durationSec: quiz.durationSec,
            startedAt: quiz.startedAt,
            endsAt: quiz.endsAt,
            participants: quiz.participants.map((p) => ({
              userId: String(p.user?._id || p.user),
              name: p.user?.name ?? "(no name)",
              joinedAt: p.joinedAt,
            })),
            serverTime: new Date(),
            youAreOwner: isOwner,
          },
        });
      } catch {
        ack?.({ ok: false, error: { code: "INTERNAL", message: err.message } });
      }
    });

    socket.on("quiz:start", (_payload, ack) => {
      ack?.({
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Use HTTP POST /api/quizzes/:quizId/start",
        },
      });
    });

    socket.on("quiz:end", (_payload, ack) => {
      ack?.({
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Use HTTP POST /api/quizzes/:quizId/end",
        },
      });
    });
  });

  return io;
}
