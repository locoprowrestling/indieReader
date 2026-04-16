import fs from "node:fs";

const CONFIG_URL = new URL("../config/sources.json", import.meta.url);

export function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_URL, "utf-8"));
}
