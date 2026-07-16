import * as dotenv from "dotenv";
import path from "path";
import { getVercelProjects } from "../helpers/getVercelProjects.js";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Configuration
// FILTER_MODE controls which sites are targeted:
//   "since"  — rebuild sites that haven't successfully rebuilt SINCE startDate (last successful deployment < startDate)
//   "range"  — rebuild sites that were successfully rebuilt between startDate and endDate (inclusive)
const FILTER_MODE = "since"; // "since" | "range"

// Time is specified in Eastern Time. Use -05:00 for EST (Nov–Mar) or -04:00 for EDT (Mar–Nov, daylight saving).
// June 10th falls within daylight saving time, so EDT (-04:00) applies here.
const startDate = new Date("2026-06-10T11:00:00-04:00"); // 11:00 AM EDT on June 10th
// const startDate = new Date("2026-05-04T14:20:00-04:00"); // 2:20 PM EDT on May 4th
// const endDate = new Date("2026-05-05T13:09:00-04:00"); // only used when FILTER_MODE = "range"
const batchSize = 2; // Number of projects to rebuild in one batch
const BATCH_DELAY_MS = 3.5 * 60 * 1000; // Delay between batches (3.5 minutes)
const DEPRIORITIZE_KEYWORDS = true; // Set to true to sort "demo" and "micro" projects to the end
const SKIP_NAMES_LIKE = ["qa-truspd", "truspeed-v2", "truspeed"];
// If non-empty, only these exact project names will be considered (date constraints still apply).
// Leave empty to target all projects as usual.
const PROJECT_FILTER = [
  "demo-v3",
  "the-bath-boys-tbb-main-site",
  "carolina-home-remodeling-chr-main-site",
  "galla-rini-roofing-gr-main-site",
  "sweetwater-home-services-main-site-sms",
  "bath-works-mi-bwmi-main-site",
  "home-pro-mi-hpmi-main-site",
  "all-american-roofing-aar-main",
  "aspen-windows-aspen-main",
  "wealthy-contractor-twc-main",
  "men-with-tools-mwt-main",
  "nulook-hd-nhd-main",
  "jacuzzi-jbrx-fl-baths",
  "precision-roofing-precision-roofing-main",
  "customfit-baths-customfit-main",
  "innovative-exteriors-main-innovative-exteriors",
  "frey-frey-main",
  "jacuzzi-jbrx-or-baths",
  "jim-woods-roofing-jim-woods-roofing",
  "jacuzzi-jbr-main",
  "integrity-home-pro-ihp-main",
  "paulson-monuments-paulson-monuments",
  "mattsson-roofing-mattsson-main",
  "floortek-floortek-main",
  "signature-home-services-shs-main-site",
  "jacuzzi-jbrx-atl-baths",
  "roofing-store-roofing-store-main",
  "erdmann-exteriors-main-erdmann-ext",
  "floortek-ox-floors-main",
  "jacuzzi-jbrx-az-baths",
  "erdmann-outdoor-living-outdoor-living-main",
  "bee-windows-bee-windows-main",
  "jacuzzi-jbrx-sea-baths",
  "alco-products-main-alco",
  "jacuzzi-jbrx-stl-baths",
  "kubala-home-improvement-main-kubala",
  "rainsoft-great-lakes-main-great-lakes-wt",
  "florida-energy-water-air-pure-lp-fewa-pentair-new",
  "jacuzzi-bathwraps-promo",
  "jjs-custom-jjs-main",
  "black-rock-roofing-brr-main",
  "hutchco-home-and-bath-hchb-main",
  "ltg-coatings-ltgc-main",
  "asp-superhome-main-asp-sh",
  "jacuzzi-jbrx-de-baths",
  "five-star-homes-five-star-main",
  "refloor-refloor-main",
  "asp-windows-main-asp-w",
  "jacuzzi-jbrx-nc-baths",
  "floorology-floorology",
  "premier-home-services-phs-main",
  "gutter-cover-kc-gckc-main",
  "stressless-remodeling-sr-main",
  "twin-cities-jacuzzi-main-tcj",
  "scc-pros-swhi-main",
  "denver-pergolas-denver-pergolas",
  "kitchen-restyled-kitchen-restyled",
  "bath-experts-main-bath-experts",
  "pro-home-1-ph1-main",
  "cornerstone-construction-cc-main",
  "exterior-pros-ext-pros",
  "jacuzzi-jbr-of-california",
  "struxure-atl-struxure-atl",
  "window-perfections-wp-main",
  "1364-services-1364-main",
  "endless-poxybilities-ep-main",
  "southwest-style-southwest-main",
  "deck-and-drive-d-a-d",
  "continental-siding-cs-main",
  "bluebird-windows-doors-main-bbwd",
  "heins-contracting-hc-main",
  "heins-contracting-hc-micro-roofing",
  "heins-contracting-hc-micro-siding",
  "heins-contracting-hc-micro-windows",
  "calm-water-and-bath-cwb-main",
  "yancey-home-improvements-yancey-main",
  "wonder-windows-showers-baths-wwsb-main",
  "windows-doors-carolinas-wdc-main",
  "wonder-windows-showers-baths-wwsb-micro-baths",
  "jacuzzi-jbr-custom",
  "outdoor-altimate-altimate-main",
  "outback-deck-od-main",
  "your-home-improvement-co-yhi-main",
  "jacuzzi-jbrx-houston-baths",
  "southern-showers-ss-main",
  "southern-showers-lp-welcome",
  "peg-sur-lp-peg-sur",
];

// Vercel API URL
const vercelUrl = `https://api.vercel.com/v13/deployments?teamId=${process.env.VERCEL_TEAM_ID}&forceNew=1`;

// Validate env variables are set
if (!process.env.VERCEL_API_TOKEN || !process.env.VERCEL_TEAM_ID) {
  console.log("Error: VERCEL_API_TOKEN and VERCEL_TEAM_ID must be set in .env");
  process.exit(1);
}

const filterDescription =
  FILTER_MODE === "range"
    ? `between ${startDate.toISOString()} and ${endDate.toISOString()}`
    : `before ${startDate.toISOString()}`;
console.info(
  `Starting rebuild of sites last deployed ${filterDescription} in batches of ${batchSize}...`,
);
if (PROJECT_FILTER.length > 0) {
  console.info(
    `Project filter active — only rebuilding: ${PROJECT_FILTER.join(", ")}`,
  );
}

async function getFilteredSites() {
  const allProjects = await getVercelProjects();
  const vercelProjects =
    PROJECT_FILTER.length > 0
      ? allProjects.filter((p) => PROJECT_FILTER.includes(p.name))
      : allProjects;
  if (PROJECT_FILTER.length > 0) {
    console.log(
      `Found ${vercelProjects.length}/${PROJECT_FILTER.length} projects matching the project filter`,
    );
  }

  const filteredProjects = [];
  const erroredProjects = [];

  for (const project of vercelProjects) {
    const lastSuccessfulDeployment =
      project?.lastSuccessfulDeployment?.updatedAt;
    const lastDeployment = project?.lastDeployment?.updatedAt;

    if (
      ["BUILDING", "QUEUED"].includes(project.latestDeploymentState) ||
      SKIP_NAMES_LIKE.some((keyword) => project.name.includes(keyword))
    ) {
      if (SKIP_NAMES_LIKE.some((keyword) => project.name.includes(keyword))) {
        console.log(
          `Project ${project.name} is being skipped due to matching skip keyword. Skipping for now.`,
        );
      } else {
        console.log(
          `Project ${project.name} has a deployment in progress (state: ${project.latestDeploymentState}), skipping for now.`,
        );
        continue;
      }
    }

    if (FILTER_MODE === "range") {
      const inRange =
        lastSuccessfulDeployment >= startDate &&
        lastSuccessfulDeployment <= endDate;
      if (
        (inRange &&
          lastDeployment &&
          lastDeployment > endDate &&
          project.latestDeploymentState === "ERROR") ||
        (lastDeployment >= startDate &&
          lastDeployment <= endDate &&
          project.latestDeploymentState === "ERROR")
      ) {
        erroredProjects.push(project);
      } else if (inRange) {
        filteredProjects.push(project);
      } else if (!lastSuccessfulDeployment) {
        console.log(
          "Project",
          project.name,
          "has no successful deployments. Last deployment:",
          lastDeployment ? new Date(lastDeployment).toISOString() : "N/A",
          project.latestDeploymentState,
        );
      }
    } else {
      // "since" mode: target sites not successfully rebuilt since startDate
      if (
        (lastSuccessfulDeployment < startDate &&
          lastDeployment &&
          lastDeployment > startDate) ||
        (lastDeployment > startDate &&
          project.latestDeploymentState === "ERROR")
      ) {
        erroredProjects.push(project);
      } else if (lastSuccessfulDeployment < startDate) {
        filteredProjects.push(project);
      } else if (!lastSuccessfulDeployment) {
        console.log(
          "Project",
          project.name,
          "has no successful deployments. Last deployment:",
          lastDeployment ? new Date(lastDeployment).toISOString() : "N/A",
          project.latestDeploymentState,
        );
        filteredProjects.push(project);
      }
    }
  }

  if (DEPRIORITIZE_KEYWORDS) {
    const priority = (name) => {
      if (name.includes("old") || name.includes("v0")) return 4;
      if (name.includes("test") || name.includes("qa")) return 3;
      if (name.includes("demo")) return 2;
      if (name.includes("micro")) return 1;
      return 0;
    };
    filteredProjects.sort((a, b) => {
      const priorityDiff = priority(a.name) - priority(b.name);
      if (priorityDiff !== 0) return priorityDiff;
      return (
        (a.lastSuccessfulDeployment?.updatedAt ?? 0) -
        (b.lastSuccessfulDeployment?.updatedAt ?? 0)
      );
    });

    // TEMP break
    // check if top project  is priority 3, if so, throw error to stop
    if (
      filteredProjects.length > 0 &&
      priority(filteredProjects[0].name) >= 3
    ) {
      console.warn(
        `Top project ${filteredProjects[0].name} has a high priority keyword. Stopping rebuild to avoid rebuilding non-demo sites. Please review the filtered projects list and adjust the DEPRIORITIZE_KEYWORDS logic or project naming as needed.`,
      );
      process.exit(1);
    }
  }

  return [filteredProjects, erroredProjects];
}

async function rebuildSite(projectName, gitRepo) {
  console.log(
    `\tRebuilding site https://vercel.com/site-builder-e8394a8e/${projectName}/deployments/ ...`,
  );
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
    console.error(
      `\t\t❌ Failed rebuilding site https://vercel.com/site-builder-e8394a8e/${projectName}/deployments: ${response.statusText}`,
    );
    return `Error rebuilding site https://vercel.com/site-builder-e8394a8e/${projectName}/deployments: ${response.statusText}`;
  }
  const data = await response.json();
}

async function rebuildFilteredSites() {
  const [filteredProjects, erroredProjects] = await getFilteredSites();
  const names = filteredProjects.map((project) => project.name);
  console.log(
    `Found ${filteredProjects.length} projects with last successful deployment ${filterDescription}:`,
  );

  const errors = [];
  let rebuildingCount = 0;

  for (const project of filteredProjects) {
    // return
    const errorMessage = await rebuildSite(
      project?.name,
      project?.repository?.repo,
    );
    if (errorMessage) {
      errors.push(errorMessage);
    } else {
      rebuildingCount++;
    }
    if (rebuildingCount === batchSize) {
      break;
    }
  }

  console.log(`Rebuilding ${rebuildingCount} projects in this batch...`);

  // return remaining projects count
  const remainingProjects = filteredProjects.length - rebuildingCount;
  if (remainingProjects === 0 || rebuildingCount === 0) {
    console.log("\nFinished rebuilding!");
    console.log(
      `There are ${erroredProjects.length + errors.length} projects that require additional attention with errors:`,
    );
    erroredProjects.forEach((project) => {
      console.log(
        `\t- https://vercel.com/site-builder-e8394a8e/${project.name}/deployments`,
      );
      console.log(
        `\t\t (Last Deployment State: ${project.latestDeploymentState}, Last Successful Deployment: ${project.lastSuccessfulDeployment?.updatedAt})`,
      );
    });
    if (errors.length > 0) {
      errors.forEach((error) => console.log(`\t- ${error}`));
    }
    return [0, erroredProjects];
  }
  return [remainingProjects, erroredProjects];
}

async function runRebuildLoop() {
  while (true) {
    console.log("\n--- Running rebuildFilteredSites ---");
    const [remainingProjects, erroredProjects] = await rebuildFilteredSites();

    if (remainingProjects === 0) {
      console.log("No more projects to rebuild. Exiting loop.");
      // console.log(
      //   `There are ${erroredProjects.length} projects that require additional attention with errors:`,
      //   erroredProjects
      // );
      break;
    }

    const remainingBatches = Math.ceil(remainingProjects / batchSize);
    const estimatedMs = remainingBatches * BATCH_DELAY_MS;
    const estimatedHours = Math.floor(estimatedMs / 3600000);
    const estimatedMinutes = Math.round((estimatedMs % 3600000) / 60000);
    const timeRemaining =
      estimatedHours > 0
        ? `${estimatedHours}h ${estimatedMinutes}m`
        : `${estimatedMinutes}m`;
    console.log(
      `${remainingProjects} projects remaining (~${remainingBatches} batches, est. ${timeRemaining}). Sleeping for ${BATCH_DELAY_MS / 60000} minutes...`,
    );
    // List errors
    if (erroredProjects.length > 0) {
      console.log(
        `Projects with deployment errors that may require attention:`,
      );
      erroredProjects.forEach((project) => {
        console.log(
          `\t- https://vercel.com/site-builder-e8394a8e/${project.name}/deployments`,
        );
        console.log(
          `\t\t (Last Deployment State: ${project.latestDeploymentState}, Last Successful Deployment: ${project.lastSuccessfulDeployment?.updatedAt})`,
        );
      });
    }
    await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
  }
}

runRebuildLoop().catch((error) => {
  console.error("Error in rebuild loop:", error);
  process.exit(1);
});
