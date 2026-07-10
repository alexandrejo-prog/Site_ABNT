import React from "react";
import ReactDOM from "react-dom/client";
import "./docx-toc-field-patch";
import App from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import "./styles.css";
import "./accessibility.css";
import "./ux-fixes.css";
import "./editor-enhancer.css";
import "./word-toolbar.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
