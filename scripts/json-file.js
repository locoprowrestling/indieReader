import fs from "node:fs";
import { fileURLToPath } from "node:url";

function formatPath(filePath) {
  return filePath instanceof URL ? fileURLToPath(filePath) : filePath;
}

export function readJsonFile(filePath, description = "JSON file") {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    const action = error instanceof SyntaxError ? "parse" : "read";
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to ${action} ${description} at ${formatPath(filePath)}: ${message}`);
  }
}

export function readJsonFileIfExists(filePath, fallbackValue, description = "JSON file") {
  if (!fs.existsSync(filePath)) {
    return fallbackValue;
  }

  return readJsonFile(filePath, description);
}
