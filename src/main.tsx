import ReactDOM from "react-dom/client";
import App from "./App";

// No <StrictMode>: the root effect owns the engine subprocess, and StrictMode's
// intentional double-mount in dev would spawn (and orphan) a second agent.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<App />);
