
import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const VERCEL_TOKEN = process.env.VERCEL_API_TOKEN;
const TEAM_ID = process.env.VERCEL_TEAM_ID;

if (!VERCEL_TOKEN || !TEAM_ID) {
  console.error("Error: VERCEL_API_TOKEN or VERCEL_TEAM_ID is not set in the environment variables.");
  process.exit(1);
}

async function getAllProjects() {
  const projects = [];
  let next;

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
    autoExposeSystemEnvs: p.autoExposeSystemEnvs ?? false,
    framework: p.framework ?? "unknown",
  }));

  const disabled = rows.filter((r) => !r.autoExposeSystemEnvs);

  console.log(`Projects without System Environment Variables enabled (${disabled.length}/${rows.length}):`);
  console.table(disabled);
}

main().catch(console.error);
