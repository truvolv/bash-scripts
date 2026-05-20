import fetch from "node-fetch";
import * as dotenv from "dotenv";
import path from "path";
import { uptime } from "process";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const token = process.env.VERCEL_API_TOKEN;
const teamId = process.env.VERCEL_TEAM_ID;

if (!token) {
  console.error("Error: VERCEL_API_TOKEN is required in your .env file");
  process.exit(1);
}

async function fetchProjects(until = undefined) {
  // check for env variables
  if( !token) {
    throw new Error("Env variable 'VERCEL_API_TOKEN' is not set");
  } else if (!teamId) {
    throw new Error("Env variable 'VERCEL_TEAM_ID' is not set");
  }
  
  const baseUrl = "https://api.vercel.com/v9/projects";
  const params = new URLSearchParams({
    limit: "100",
  });

  if (teamId) params.append("teamId", teamId);
  if (until) params.append("until", until);

  const url = `${baseUrl}?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

function getProjectUrls(project) {
  const urls = {
    vercelUrl: null,
    customDomains: null, // Using Set to avoid duplicates
  };

  // Check production targets aliases (primary source for custom domains)
  if (project.targets?.production?.alias) {
    const customUrls = project.targets.production.alias.filter(
      (url) => !url.includes(".vercel.app") && url.includes("www.")
    );
    if (customUrls && customUrls.length > 0) {
      urls.customDomains = customUrls[0];
    }

    const vercelUrls = project.targets.production.alias.filter((url) =>
      url.includes(".vercel.app")
    );
    if (vercelUrls && vercelUrls.length > 0) {
      urls.vercelUrl = vercelUrls[0];
    }
  }

  return {
    vercelUrl: urls.vercelUrl,
    customDomains: urls.customDomains,
  };
}

export async function getVercelProjects() {
  let allProjects = [];
  let hasMore = true;
  let until = undefined;

  const concerningBuilds = [];

  while (hasMore) {
    const data = await fetchProjects(until);
``
    const formattedProjects = data.projects.map((project, i) => {
      const urls = getProjectUrls(project);

      const repoUrl =
        project.link?.repo && project.link?.org
          ? `https://github.com/${project.link.org}/${project.link.repo}`
          : null;

      const readyState = project?.latestDeployments?.[0]?.readyState;

      // latestDeployments only contains a small window of recent deployments, so a READY one
      // may not appear even if a successful deployment exists. Fall back to targets.production,
      // which always reflects the current live production deployment.
      const lastSuccessfulDeployment =
        project.latestDeployments?.find((deployment) => deployment.readyState === "READY") ??
        (project.targets?.production?.readyState === "READY" ? project.targets.production : null);

      if(!readyState === 'READY') {
        concerningBuilds.push({
          name: project.name,
          readyState,
          updatedAt: project.updatedAt,
        });
      }

      return {
        name: project.name,
        urls: {
          vercel: urls.vercelUrl,
          custom: urls.customDomains,
        },
        id: project.id,
        repository: {
          org: project.link?.org,
          repo: project.link?.repo,
          repoUrl,
        },
        lastDeployment: {
            url: project.latestDeployments?.[0]?.url || null,
            updatedAt: project.latestDeployments?.[0]
              ? new Date(project.latestDeployments[0].createdAt)
              : null,
            state: project.latestDeployments?.[0]?.readyState || null,
        },
        latestDeploymentState: readyState || null,
        lastSuccessfulDeployment: lastSuccessfulDeployment
          ? {
              url: lastSuccessfulDeployment.url,
              updatedAt: new Date(lastSuccessfulDeployment.createdAt),
              state: lastSuccessfulDeployment.readyState,
            }
          : null,
      };
    });

    allProjects = [...allProjects, ...formattedProjects];

    hasMore = data.pagination?.next !== null;
    until = data.pagination?.next;
  }

  // Sort projects by update date (most recent first)
  allProjects.sort((a, b) => new Date(b.lastDeployment?.updatedAt) - new Date(a.lastDeployment?.updatedAt));
  return allProjects;
}
