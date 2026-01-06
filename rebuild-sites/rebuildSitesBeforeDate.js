import * as dotenv from "dotenv";
import path from "path";
import { getVercelProjects } from "../helpers/getVercelProjects.js";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Configuration
const startDate = new Date("2025-12-20T00:30:05.345Z");
const batchSize = 5; // Number of projects to rebuild in one batch

// Vercel API URL
const vercelUrl = `https://api.vercel.com/v13/deployments?teamId=${process.env.VERCEL_TEAM_ID}&forceNew=1`;

// Validate env variables are set
if (!process.env.VERCEL_API_TOKEN || !process.env.VERCEL_TEAM_ID) {
  console.log("Error: VERCEL_API_TOKEN and VERCEL_TEAM_ID must be set in .env");
  process.exit(1);
}

console.info(
  `Starting rebuild of sites updated before ${startDate.toISOString()} in batches of ${batchSize}...`
);

async function getSitesBeforeDate() {
  const vercelProjects = await getVercelProjects();

  const filteredProjects = [];
  const erroredProjects = [];

  for (const project of vercelProjects) {
    const lastSuccessfulDeployment =
      project?.lastSuccessfulDeployment?.updatedAt;
    const lastDeployment = project?.lastDeployment?.updatedAt;

    // When there's a more recent attempted deployment since the startDate but the last successful deployment is before the startDate
    // ie the last deployment failed after the startDate
    if (
      lastSuccessfulDeployment < startDate &&
      lastDeployment &&
      lastDeployment > startDate
    ) {

      erroredProjects.push(project);
    } else if (lastSuccessfulDeployment < startDate) {
      filteredProjects.push(project);
    }
  }

  return [filteredProjects, erroredProjects];
}

async function rebuildSite(projectName, gitRepo) {
  console.log(`\tRebuilding site https://vercel.com/site-builder-e8394a8e/${projectName}/deployments/ ...`);
  const options = {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.VERCEL_API_TOKEN}`,
    },
    body: JSON.stringify({
      name: projectName,
      target: "production",
      gitSource: {
        ref: "main",
        org: "truvolv",
        type: "github",
        repo: gitRepo,
      },
    }),
  };
  const response = await fetch(vercelUrl, options);
  if (!response.ok) {
    console.error(`\t\t❌ Failed rebuilding site https://vercel.com/site-builder-e8394a8e/${projectName}/deployments: ${response.statusText}`);
    return `Error rebuilding site https://vercel.com/site-builder-e8394a8e/${projectName}/deployments: ${response.statusText}`;
  }
  const data = await response.json();
}

async function rebuildSitesBeforeDate() {
  const [filteredProjects, erroredProjects] = await getSitesBeforeDate();
  (filteredProjects.map((project) => project.name));
  console.log(
    `${
      filteredProjects.length
    } projects to rebuild before ${startDate.toISOString()}`
  );

  const errors = [];
  let rebuildingCount = 0;

  for (const project of filteredProjects) {
    const errorMessage = await rebuildSite(project?.name, project?.repository?.repo);
    if (errorMessage) {
      errors.push(errorMessage);
    } else {}
    rebuildingCount++;
    if (rebuildingCount === batchSize) {
      break;
    }
  }

    console.log(`Rebuilding ${rebuildingCount} projects in this batch...`);


  // return remaining projects count
  const remainingProjects = filteredProjects.length - rebuildingCount;
  if(remainingProjects === 0) {
    console.log("\nFinished rebuilding!")
    console.log(`There are ${erroredProjects.length + errors.length} projects that require additional attention with errors:`);
    erroredProjects.forEach((project) => {
      console.log(`\t- https://vercel.com/site-builder-e8394a8e/${project.name}/deployments`);
      console.log(`\t\t (Last Deployment State: ${project.latestDeploymentState}, Last Successful Deployment: ${project.lastSuccessfulDeployment?.updatedAt})`)
    });
    if (errors.length > 0) {
      errors.forEach((error) => console.log(`\t- ${error}`));
    }
  }
  return remainingProjects;
}

rebuildSitesBeforeDate().catch((error) => {
  console.error("Error rebuilding sites:", error);
  process.exit(1);
});
