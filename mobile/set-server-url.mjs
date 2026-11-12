// Runs after every `cap copy` / `cap sync` (npm hook in package.json). The offline page is served from the app itself
// (https://localhost, and Capacitor serves nothing else there), so it can't know where the site lives: write the URL
// Capacitor just put in its generated config, the Vercel site or CAP_SERVER_URL while testing, into the copied page.
import { readFileSync, writeFileSync } from "node:fs";

const dir = "android/app/src/main/assets";
const { server } = JSON.parse(readFileSync(`${dir}/capacitor.config.json`, "utf8"));
const page = `${dir}/public/offline.html`;
writeFileSync(page, readFileSync(page, "utf8").replace("__SERVER_URL__", server.url));
console.log(`offline page: Try again opens ${server.url}`);
