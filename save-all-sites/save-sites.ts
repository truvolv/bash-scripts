import * as dotenv from "dotenv";
import payload from "payload";
import fs from "fs";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const BATCH_SIZE = 1;

/* ================================
   LOGGING SETUP
================================ */

const logDir = path.join(process.cwd(), "save-all-sites/logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logFile = path.join(logDir, `changelog.log`);

function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}`;
  console.log(line);
  fs.appendFileSync(logFile, line + "\n");
}

/* ================================
   TRACK SUCCESSFUL UPDATES
================================ */

const STATUS_DIR = path.join(process.cwd(), "save-all-sites/site-status");
if (!fs.existsSync(STATUS_DIR)) {
  fs.mkdirSync(STATUS_DIR, { recursive: true });
}

const STATUS_FILE = path.join(STATUS_DIR, "completed-sites.json");

// Load previously completed site IDs
function loadCompletedSites(): Set<string> {
  try {
    if (fs.existsSync(STATUS_FILE)) {
      const data = fs.readFileSync(STATUS_FILE, "utf8");
      const completed = JSON.parse(data);
      log(
        `📋 Loaded ${completed.length} previously completed sites from site status`,
      );
      return new Set(completed);
    }
  } catch (err) {
    log(`⚠️  Error loading site status file: ${err.message}`);
  }
  return new Set();
}

// Save a completed site ID
function saveCompletedSite(siteId: string) {
  try {
    let completed = [];
    if (fs.existsSync(STATUS_FILE)) {
      const data = fs.readFileSync(STATUS_FILE, "utf8");
      completed = JSON.parse(data);
    }

    if (!completed.includes(siteId)) {
      completed.push(siteId);
      fs.writeFileSync(STATUS_FILE, JSON.stringify(completed, null, 2));
    }
  } catch (err) {
    log(`⚠️  Error saving site status: ${err.message}`);
  }
}

/* ================================
   LOAD SITES FROM JSON FILE
================================ */

interface SiteEntry {
  _id: {
    $oid: string;
  };
  tenantName: string;
  name: string;
}

function loadSitesFromJson(filePath: string): SiteEntry[] {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    log(`📂 Loading sites from: ${fullPath}`);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }

    const data = fs.readFileSync(fullPath, "utf8");
    const sites = JSON.parse(data);

    if (!Array.isArray(sites)) {
      throw new Error("JSON file must contain an array of sites");
    }

    log(`📊 Loaded ${sites.length} sites from JSON file`);
    return sites;
  } catch (err) {
    log(`❌ Error loading JSON file: ${err.message}`);
    throw err;
  }
}

/* ================================
   SAFETY CHECKS
================================ */

if (!process.env.DATABASE_URI) {
  throw new Error("DATABASE_URI is not defined.");
}

const isProd = process.env.DATABASE_URI.includes("truspeed-v2-db-cluster");
log(`Connecting to ${isProd ? "PROD" : "LOCAL"} DB`);

/* ================================
   MAIN EXECUTION
================================ */

async function run() {
  // Get JSON file path from command line argument or use default
  const jsonFilePath =
    process.argv[2] || "./save-all-sites/site-status/sites-to-update.json";

  // Load sites from JSON file
  const sites = loadSitesFromJson(jsonFilePath);

  // Load previously completed sites
  const completedSites = loadCompletedSites();

  log("Initializing Payload...");
  const configPromise = await import("../src/payload.config");
  const config = await configPromise.default;

  await payload.init({
    config,
  });

  // Confirm actual DB connection
  const dbName =
    payload?.db?.connection?.name ||
    payload?.db?.connection?.db?.databaseName ||
    "Unknown";

  log(`Connected to database: ${dbName}`);
  log(`Batch size: ${BATCH_SIZE}`);
  log(`Total sites to process: ${sites.length}`);
  log("-------------------------------------");

  let processed = 0;
  let skipped = 0;

  while (processed < BATCH_SIZE && processed + skipped < sites.length) {
    for (const site of sites) {
      // Skip if already processed in previous run
      if (completedSites.has(site._id.$oid)) {
        skipped++;
        log(
          `SKIPPING ↺ | Site: ${site.name} - ${site._id.$oid} | Tenant: ${site.tenantName} | Already completed in previous run`,
        );
        continue;
      }

      log(
        `UPDATING ... | Site: ${site.name} - ${site._id.$oid} | Tenant: ${site.tenantName}`,
      );

      try {
        await payload.update({
          collection: "sites",
          id: site._id.$oid,
          data: {},
          overrideAccess: true,
          req: {
            bypassCreateSiteHook: true, // Custom flag to bypass createSite hook (this was causing errors due to GH workflow dispatches)
          },
        });

        processed++;

        // Save to site status immediately on success
        saveCompletedSite(site._id.$oid);
        completedSites.add(site._id.$oid);

        const percent = (
          (processed / Math.min(BATCH_SIZE, sites.length)) *
          100
        ).toFixed(2);

        log(
          `UPDATED ✔ | Site: ${site.name} - ${site._id.$oid} | Tenant: ${site.tenantName} | Progress: ${processed}/${BATCH_SIZE} (${percent}%)`,
        );
      } catch (err) {
        console.log(err);
        log(
          `ERROR ✖ | Site: ${site.name} - ${site._id.$oid} | Tenant: ${site.tenantName} | ${err.message}`,
        );
      }
    }
  }

  log("-------------------------------------");
  log(`Finished. Total newly processed: ${processed}, Skipped: ${skipped}`);
  process.exit(0);
}

run().catch((err) => {
  log(`Fatal error: ${err.message}`);
  process.exit(1);
});
