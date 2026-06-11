import { createApp } from "./app";

const app = (await createApp({ staticMode: false })).listen(3000);

console.log(`Server running at http://localhost:${app.server?.port}`);
