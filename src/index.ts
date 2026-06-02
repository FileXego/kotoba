import { createApp } from "./app";

const app = createApp({ staticMode: false }).listen(3000);

console.log(`Server running at http://localhost:${app.server?.port}`);
