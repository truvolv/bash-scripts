import { csvEscapeField } from "./parseCSVs.js";

export function log(level, msg, meta, logStream) {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}${
    meta !== undefined ? " " + JSON.stringify(meta) : ""
  }`;
  if (level === "ERROR") console.error(line);
  else if (level === "WARN") console.warn(line);
  else console.log(line);
  logStream.write(line + "\n");
}

export function logUploadedFile(key, size, uploadedLogStream) {
  if (!uploadedLogStream) return;
  const line = `[${new Date().toISOString()}] ${key} (${size} bytes)`;
  uploadedLogStream.write(line + "\n");
}

export function logFailedFile(key, error, failedCsvStream) {
  if (!failedCsvStream) return;
  const row = [key, error.replace(/\r?\n/g, " "), new Date().toISOString()]
    .map((field) => csvEscapeField(field))
    .join(",");
  failedCsvStream.write(row + "\n");
}
