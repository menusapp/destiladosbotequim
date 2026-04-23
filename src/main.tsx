import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// Side-effect import: registra window.testQzTrayConnection para teste via DevTools.
// NÃO altera o fluxo de impressão atual.
import "./lib/qzTrayTest";

createRoot(document.getElementById("root")!).render(<App />);
