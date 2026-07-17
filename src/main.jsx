import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { WorkspaceSelectionProvider } from "./context/WorkspaceSelectionContext";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <WorkspaceSelectionProvider>
        <App />
      </WorkspaceSelectionProvider>
    </AuthProvider>
  </React.StrictMode>
);
