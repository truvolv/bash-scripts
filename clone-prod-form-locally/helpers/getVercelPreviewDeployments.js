const TRUSPEED_V2_PROJECT_ID = "prj_NTHRnD6VdL36bkMp6887ffjpwOjF";
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

export async function getVercelPreviewDeployments() {
  const token = process.env.VERCEL_API_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token || !teamId) {
    throw new Error(
      "Missing required env vars: VERCEL_API_TOKEN or VERCEL_TEAM_ID",
    );
  }

  const since = Date.now() - TWO_WEEKS_MS;

  const params = new URLSearchParams({
    projectId: TRUSPEED_V2_PROJECT_ID,
    teamId,
    target: "preview",
    state: "READY",
    since: String(since),
    limit: "50",
  });

  const res = await fetch(`https://api.vercel.com/v6/deployments?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Vercel API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const deployments = data.deployments ?? [];

  // Deployments are newest-first; keep only the latest per branch
  const seen = new Set();
  return deployments.filter((d) => {
    const branch = d.meta?.githubCommitRef;
    if (!branch || seen.has(branch)) return false;
    seen.add(branch);
    return true;
  });
}
