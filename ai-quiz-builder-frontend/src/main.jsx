import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "./context/AuthProvider";
import App from "./App";
import "./index.css";
import { HashRouter } from "react-router-dom";

ReactDOM.createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <HashRouter>
      <App />
    </HashRouter>
  </AuthProvider>
);
