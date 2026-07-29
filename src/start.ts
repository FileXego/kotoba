import { createApp } from "./app";

const app = (await createApp({ staticMode: true })).listen({ port: Number(process.env.PORT ?? 3000), hostname: process.env.HOST ?? "127.0.0.1" });

console.log(`Server running at http://localhost:${app.server?.port}`);
