import { createApp } from "./app";

const app = createApp({ staticMode: true }).listen(3000);

console.log(`Server running at http://localhost:${app.server?.port}`);
