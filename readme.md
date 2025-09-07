# 🧠 AI Quiz Builder (MERN + Gemini + Socket.IO)

AI Quiz Builder lets **teachers** create/run live quizzes (manual or AI-generated) and **students** join via a **join code**. Real-time lobbies, timed sessions, auto submission on timeout, and post-quiz results/leaderboard.

---

## ✨ Features

- **Auth**: JWT login/register (student/teacher roles)
- **Quiz creation**: manual or AI (Gemini) with topic, duration, question count
- **Lobby**: students wait until teacher hits **Start**
- **Real-time**: participants, status, and timer via **Socket.IO**
- **Taking quiz**: single/multi-choice, countdown, autosubmit on end
- **Results**: per-student score view (**My Marks**) + teacher results page

---

## 🧰 Tech Stack

**Frontend**: React (Vite), React Router, Axios  
**Backend**: Node.js, Express, MongoDB (Mongoose)  
**Realtime**: Socket.IO  
**AI**: Google Gemini API  
**Security**: JWT, Helmet, CORS, Rate limit
