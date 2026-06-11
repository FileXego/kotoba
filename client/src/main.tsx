import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App";

document.cookie = "_kb=1;path=/;max-age=604800;SameSite=Lax";

createRoot(document.getElementById("root")!).render(<App />);
