import { Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Forgot from "./pages/Forgot";
import CreateQuiz from "./pages/CreateQuiz";
import Protected from "./components/Protected";
import TeacherLobby from "./pages/TeacherLobby";
import ManageLobbies from "./pages/ManageLobbies";
import StudentJoin from "./pages/StudentJoin";
import StudentLobby from "./pages/StudentLobby";
import StudentQuiz from "./pages/StudentQuiz";
import StudentResult from "./pages/StudentResult";
import MyMarks from "./pages/MyMarks";
import TeacherResults from "./pages/TeacherResults";
import TeacherQuizResults from "./pages/TeacherQuizResults";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot" element={<Forgot />} />

      {/* Only teachers can access create page */}
      <Route
        path="/create"
        element={
          <Protected allow={["teacher"]}>
            <CreateQuiz />
          </Protected>
        }
      />
      <Route
        path="/t/:quizId"
        element={
          <Protected allow={["teacher"]}>
            <TeacherLobby />
          </Protected>
        }
      />
      <Route
        path="/lobbies"
        element={
          <Protected allow={["teacher"]}>
            <ManageLobbies />
          </Protected>
        }
      />
      <Route
        path="/join"
        element={
          <Protected allow={["student"]}>
            <StudentJoin />
          </Protected>
        }
      />

      <Route
        path="/s/:quizId"
        element={
          <Protected allow={["student"]}>
            <StudentLobby />
          </Protected>
        }
      />
      <Route
        path="/play/:quizId"
        element={
          <Protected allow={["student"]}>
            <StudentQuiz />
          </Protected>
        }
      />
      <Route
        path="/results/:quizId"
        element={
          <Protected allow={["student"]}>
            <StudentResult />
          </Protected>
        }
      />

      <Route
        path="/marks"
        element={
          <Protected allow={["student"]}>
            <MyMarks />
          </Protected>
        }
      />

      <Route
        path="/t/results"
        element={
          <Protected allow={["teacher"]}>
            <TeacherResults />
          </Protected>
        }
      />

      <Route
        path="/t/results/:quizId"
        element={
          <Protected allow={["teacher"]}>
            <TeacherQuizResults />
          </Protected>
        }
      />
    </Routes>
  );
}
