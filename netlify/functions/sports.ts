// Deprecated path config version — Netlify should use sports.mjs (classic handler).
// Keep this file as a thin re-export of the classic handler if the bundler resolves .ts first.
export { handler } from "./sports.mjs";
