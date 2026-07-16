import { input, select } from "@inquirer/prompts";
import { createLocalForm } from "./helpers/createLocalForm.js";
import { getVercelPreviewDeployments } from "./helpers/getVercelPreviewDeployments.js";
import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
    // check if have the required env vars
  if (!process.env.PROD_PL_TOKEN || !process.env.LOCAL_PL_TOKEN) {
    throw new Error(
      "Missing required env var: PROD_PL_TOKEN or LOCAL_PL_TOKEN",
    );
  }

  // Ask if target CMS should be local or QA
  const targetCMS = await select({
    message: "Select target CMS:",
    default: "local",
    choices: [
      { name: "Local", value: "local" },
      { name: "QA", value: "qa" },
    ],
  });

  let qaUrl;
  if (targetCMS === "qa") {
    console.log("\nFetching preview deployments from Vercel...");
    const deployments = await getVercelPreviewDeployments();

    if (!deployments.length) {
      console.error("No ready preview deployments found for truspeed-v2.");
      return;
    }

    qaUrl = await select({
      message: "Select QA deployment:",
      choices: deployments.map((d) => {
        const branch = d.meta?.githubCommitRef ?? "unknown branch";
        const message = d.meta?.githubCommitMessage?.split("\n")[0].slice(0, 60) ?? "";
        const date = new Date(d.created).toLocaleDateString();
        return {
          name: `${branch} — ${message} (${date})`,
          value: `https://${d.url}`,
        };
      }),
    });
  }

    // --- Org slug (always needed) ---
  const orgSlug = await input({ message: "Organization slug:" });

  // --- Conditionally prompt for IDs ---
  const formId = await input({ message: "Form ID:" });

  if (!formId) {
    console.error("Form ID is required to create a form, exiting.");
    return;
  }

  console.log(`\nCreating form ${formId} for org ${orgSlug}...`);

  const { id: localFormId, url: localFormUrl } = await createLocalForm(
    orgSlug,
    formId,
    targetCMS,
    { qaUrl },
  );
  if (!localFormId || !localFormUrl) {
    console.error("Failed to create local form");
    return;
  }
  console.log(`✅ Form created with ID ${localFormId} at URL: ${localFormUrl}`);

  console.log("\nDone!");
}

main();
