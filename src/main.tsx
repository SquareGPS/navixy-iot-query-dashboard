import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./styles/tokens.css";
import "./index.css";

// Suppress React DevTools warning
if (typeof window !== 'undefined') {
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = undefined as any;
}

createRoot(document.getElementById("root")!).render(<App />);
