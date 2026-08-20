import fs from "fs";
import readline from "readline";
import { log } from "./logging.js";

export function csvEscapeField(field) {
  if (/[",\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function csvUnescapeField(field) {
  const trimmed = field.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"');
  }
  return trimmed;
}

// Reads a CSV file and returns a Set of the first column's values, skipping the header if present
export async function loadCSV(UPLOADED_MEDIA_CSV, logStream) {
  const set = new Set();
  if (!fs.existsSync(UPLOADED_MEDIA_CSV)) {
    log(
      "INFO",
      `No existing CSV found, treating as first run`,
      {
        UPLOADED_MEDIA_CSV,
      },
      logStream,
    );
    return set;
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(UPLOADED_MEDIA_CSV),
    crlfDelay: Infinity,
  });

  let isFirstLine = true;
  for await (const line of rl) {
    if (!line.trim()) continue;
    if (isFirstLine) {
      isFirstLine = false;
      if (line.trim().toLowerCase() === "filename") continue;
    }
    set.add(csvUnescapeField(line));
  }

  log("INFO", `Loaded CSV`, { UPLOADED_MEDIA_CSV, count: set.size }, logStream);
  return set;
}
