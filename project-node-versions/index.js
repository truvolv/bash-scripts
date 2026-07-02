
import * as dotenv from "dotenv";
import path from "path";
import { getVercelProjects } from "../helpers/getVercelProjects.js";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });


const VERCEL_TOKEN = process.env.VERCEL_API_TOKEN;
const TEAM_ID = process.env.VERCEL_TEAM_ID;

if(!VERCEL_TOKEN || !TEAM_ID) { 
    console.error("Error: VERCEL_API_TOKEN or VERCEL_TEAM_ID is not set in the environment variables.");
    process.exit(1);
}

async function getAllProjects() {
  const projects = [];
  let next

  do {
    const url = new URL("https://api.vercel.com/v9/projects");
    url.searchParams.set("limit", "100");
    if (TEAM_ID) url.searchParams.set("teamId", TEAM_ID);
    if (next) url.searchParams.set("until", String(next));

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
    });

    if (!res.ok) {
      throw new Error(`Vercel API error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    projects.push(...data.projects);
    next = data.pagination?.next;
  } while (next);

  return projects;
}

async function main() {
  const projects = await getAllProjects();

  const rows = projects.map((p) => ({
    name: p.name,
    nodeVersion: p.nodeVersion ?? "unset",
    framework: p.framework ?? "unknown",
  }));

  // filter where nodeVersion is '20.x'
    const filteredRows = rows.filter((r) => r.nodeVersion === "20.x");

  console.table(filteredRows);

  // Group by version for a quick summary
  const grouped = rows.reduce((acc, r) => {
    acc[r.nodeVersion] = (acc[r.nodeVersion] || 0) + 1;
    return acc;
  }, {});

  console.log("\nBreakdown:");
  console.table(grouped);
}

main().catch(console.error);