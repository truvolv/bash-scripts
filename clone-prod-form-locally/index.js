import { input } from "@inquirer/prompts";
import { createLocalForm } from "./helpers/createLocalForm.js";
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
  );
  if (!localFormId || !localFormUrl) {
    console.error("Failed to create local form");
    return;
  }
  console.log(`✅ Form created with ID ${localFormId} at URL: ${localFormUrl}`);

  console.log("\nDone!");
}

main();
