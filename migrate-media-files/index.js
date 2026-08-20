#!/usr/bin/env node
// migrate-do-to-blob.js
// Migrates files from DigitalOcean Spaces to Vercel Blob.
//
// Duplicate-check modes:
//   default            - csv mode: trusts uploaded_media_files.csv, no Blob API calls
//   --use-list-check   - lists the live Blob store instead, and can detect+recopy size mismatches
//
// Usage:
//   node index.js [options]
//
// Options:
//   --dry-run              Log what would happen, copy nothing, write nothing to disk
//   --concurrency=N        Parallel workers (default 10)
//   --batch-size=N         Only process the first N DO objects this run (for staged/incremental runs)
//   --use-list-check       Use Blob's list() API to detect duplicates instead of the CSV file
//
// Required env vars:
//   DO_SPACES_ACCESS_KEY, DO_SPACES_SECRET_KEY, DO_SPACES_ENDPOINT,
//   DO_SPACES_REGION, DO_SPACES_BUCKET, BLOB_READ_WRITE_TOKEN

import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getCliArgs } from "./helpers/getCliArgs.js";
import { log, logUploadedFile, logFailedFile } from "./helpers/logging.js";
import { runWithConcurrency } from "./helpers/runWithConcurrency.js";
import { loadCSV, csvEscapeField } from "./helpers/parseCSVs.js";
import { listAllDOObjects } from "./helpers/listAllDOObjects.js";
import { buildBlobIndex } from "./helpers/buildBlobIndex.js";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { put } from "@vercel/blob";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const LOGS_DIR = path.join(__dirname, "logs");
const CSV_DIR = path.join(__dirname, "csvs");
const LOG_FILE = path.join(LOGS_DIR, "logs.log");
const UPLOADED_LOG_FILE = path.join(LOGS_DIR, "uploaded_media_files.log");
const UPLOADED_MEDIA_CSV = path.join(CSV_DIR, "uploaded_media_files.csv");
const FAILED_MEDIA_CSV = path.join(CSV_DIR, "failed_media_uploads.csv");

fs.mkdirSync(LOGS_DIR, { recursive: true });
fs.mkdirSync(CSV_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

export const logStream = fs.createWriteStream(LOG_FILE, { flags: "a" });
let uploadedLogStream = null;
let failedCsvStream = null;

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

// adds the next file to the batch for migration, if available
// will only run if a batch size is specified and a file in the batch size was skipped
function addFileToBatch(context) {
  const { doObjects, batchSize, doObjectsToMigrate } = context;

  if (!batchSize) return;
  if (context.nextCandidateIndex >= doObjects.length) return;
  doObjectsToMigrate.push(doObjects[context.nextCandidateIndex]);
  context.nextCandidateIndex++;
}

async function migrateOneItem(item, context) {
  const { key, size } = item;
  const { s3, bucket, blobToken, dryRun, stats } = context;

  if (context.mode === "list") {
    const existingSize = context.blobIndex.get(key);
    if (existingSize !== undefined) {
      if (existingSize === size) {
        stats.skipped++;
        addFileToBatch(context);
        log(
          "INFO",
          `Skipping (already in Blob, size matches)`,
          { key },
          logStream,
        );
        return;
      }
      log(
        "WARN",
        `Size mismatch, re-copying`,
        {
          key,
          doSize: size,
          blobSize: existingSize,
        },
        logStream,
      );
      stats.recopied++;
    }
  } else {
    if (context.csv.has(key)) {
      stats.skipped++;
      addFileToBatch(context);
      log("INFO", `Skipping (present in CSV)`, { key }, logStream);
      return;
    }
  }

  if (dryRun) {
    log("INFO", `[DRY RUN] Would migrate`, { key, size }, logStream);
    stats.copied++;
    return;
  }

  try {
    // pulls media object from DO Spaces, then pushes to Vercel Blob
    const obj = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const chunks = [];
    for await (const chunk of obj.Body) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    await put(key, buffer, {
      access: "public",
      token: blobToken,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: obj.ContentType,
    });

    stats.copied++;
    log("INFO", `Migrated`, { key, size }, logStream);
    logUploadedFile(key, size, uploadedLogStream);

    context.csvAppendStream.write(csvEscapeField(key) + "\n");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stats.failed++;
    log("ERROR", `Failed to migrate`, { key, error: message }, logStream);
    logFailedFile(key, message, failedCsvStream);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = getCliArgs(process.argv);

  const required = [
    "DO_SPACES_ACCESS_KEY",
    "DO_SPACES_SECRET_KEY",
    "DO_SPACES_ENDPOINT",
    "DO_SPACES_REGION",
    "DO_SPACES_BUCKET",
    "BLOB_READ_WRITE_TOKEN",
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    log(
      "ERROR",
      `Missing required environment variables`,
      { missing },
      logStream,
    );
    process.exit(1);
  }

  const bucket = process.env.DO_SPACES_BUCKET;
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  const mode = args.useListCheck ? "list" : "csv";

  const s3 = new S3Client({
    credentials: {
      accessKeyId: process.env.DO_SPACES_ACCESS_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET_KEY,
    },
    endpoint: process.env.DO_SPACES_ENDPOINT,
    region: process.env.DO_SPACES_REGION,
    forcePathStyle: false,
  });

  log(
    "INFO",
    `Starting migration`,
    {
      mode,
      dryRun: args.dryRun,
      concurrency: args.concurrency,
      batchSize: args.batchSize,
    },
    logStream,
  );

  const stats = {
    copied: 0,
    skipped: 0,
    failed: 0,
    recopied: 0,
    totalRemaining: 0,
    total: 0,
  };

  const csv = await loadCSV(UPLOADED_MEDIA_CSV, logStream);

  let blobIndex = null;
  if (mode === "list") {
    log(
      "INFO",
      `Building Blob index via list() - this re-lists the full store every run`,
      undefined,
      logStream,
    );
    blobIndex = await buildBlobIndex(blobToken, logStream);
  }

  let csvAppendStream = null;
  if (!args.dryRun) {
    uploadedLogStream = fs.createWriteStream(UPLOADED_LOG_FILE, { flags: "a" });

    csvAppendStream = fs.createWriteStream(UPLOADED_MEDIA_CSV, {
      flags: "a",
    });
    if (
      !fs.existsSync(UPLOADED_MEDIA_CSV) ||
      fs.statSync(UPLOADED_MEDIA_CSV).size === 0
    ) {
      csvAppendStream.write("filename\n");
    }

    failedCsvStream = fs.createWriteStream(FAILED_MEDIA_CSV, { flags: "a" });
    if (
      !fs.existsSync(FAILED_MEDIA_CSV) ||
      fs.statSync(FAILED_MEDIA_CSV).size === 0
    ) {
      failedCsvStream.write("filename,error,timestamp\n");
    }
  }

  log("INFO", `DO Spaces bucket`, { bucket }, logStream);
  const doObjects = await listAllDOObjects(s3, bucket, logStream);
  stats.total = doObjects.length;

  let doObjectsToMigrate = [];
  let nextCandidateIndex = args.batchSize ? args.batchSize : doObjects.length;

  log(
    "INFO",
    `Found DO Spaces objects`,
    { count: doObjects.length },
    logStream,
  );

  if (args.batchSize) {
    doObjectsToMigrate = doObjects.slice(0, args.batchSize);
    log(
      "INFO",
      `Limiting to first ${args.batchSize} unmigrated objects this run`,
      { batchSize: args.batchSize },
      logStream,
    );
  } else {
    doObjectsToMigrate = doObjects;
  }

  const context = {
    s3,
    bucket,
    blobToken,
    dryRun: args.dryRun,
    batchSize: args.batchSize,
    mode,
    blobIndex,
    csv,
    csvAppendStream,
    stats,
    doObjects,
    doObjectsToMigrate,
    nextCandidateIndex,
  };

  // SIGINT handler to gracefully stop the migration if the user presses Ctrl+C
  // this ensures that any in progress transfers are completed before the script exits
  // especially helpful when running concurrent file uploads
  const pool = runWithConcurrency(
    doObjectsToMigrate,
    args.concurrency,
    (item) => migrateOneItem(item, context),
  );

  process.on("SIGINT", () => {
    log(
      "WARN",
      `Received SIGINT, finishing in-flight transfers and stopping`,
      undefined,
      logStream,
    );
    pool.abort();
  });

  await pool.done;

  if (csvAppendStream) csvAppendStream.end();
  if (uploadedLogStream) uploadedLogStream.end();
  if (failedCsvStream) failedCsvStream.end();

  stats.totalRemaining =
    stats.total - (stats.copied + stats.skipped - stats.failed);

  log("INFO", `Migration complete`, stats, logStream);
  if (stats.failed > 0) {
    log(
      "WARN",
      `Some files failed - see failed_media_uploads.csv for details`,
      { failed: stats.failed },
      logStream,
    );
  }
}

main().catch((err) => {
  log(
    "ERROR",
    `Fatal error`,
    {
      error: err instanceof Error ? err.message : String(err),
    },
    logStream,
  );
  process.exit(1);
});
