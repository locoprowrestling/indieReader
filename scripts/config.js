import { readJsonFile } from "./json-file.js";

const CONFIG_URL = new URL("../config/sources.json", import.meta.url);

export function readConfig() {
  return readJsonFile(CONFIG_URL, "source config");
}
