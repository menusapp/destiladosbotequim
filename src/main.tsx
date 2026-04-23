import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installProductionLogSilencer } from "./lib/logger";

// Silencia console.log/info/warn/debug em produção (mantém console.error).
// Em dev/preview, todos os logs continuam funcionando normalmente.
installProductionLogSilencer();

// Side-effect import: registra window.testQzTrayConnection para teste via DevTools.
// NÃO altera o fluxo de impressão atual.
import "./lib/qzTrayTest";
import "./lib/qzTrayPrintTest";
import "./lib/qzPrinterConfig";
import "./lib/printOrderWithQz";

createRoot(document.getElementById("root")!).render(<App />);
