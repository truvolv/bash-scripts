import { input, select } from "@inquirer/prompts";
import { createLocalForm } from "./helpers/createLocalForm.js";
import { fetchOrganizations } from "./helpers/fetchOrganizations.js";
import { promptForEnvironment } from "./helpers/promptForEnvironment.js";
import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const MANUAL_ENTRY = "__manual_entry__";



async function promptForOrgSlug(environment, roleLabel) {
  let orgs = [];
  try {
    orgs = await fetchOrganizations({
      baseUrl: environment.baseUrl,
      plToken: environment.envVars.plToken.value,
    });
  } catch (err) {
    console.warn(
      `Could not fetch organization list from ${environment.label}: ${err.message}`,
    );
  }

  if (!orgs.length) {
    return input({ message: `${roleLabel} (${environment.label}) organization slug:` });
  }

  const selected = await select({
    message: `${roleLabel} (${environment.label}) organization:`,
    choices: [
      ...orgs.map((org) => ({ name: `${org.name} (${org.slug})`, value: org.slug })),
      { name: "Other (enter slug manually)", value: MANUAL_ENTRY },
    ],
  });

  if (selected === MANUAL_ENTRY) {
    return input({ message: `${roleLabel} (${environment.label}) organization slug:` });
  }

  return selected;
}

async function main() {
  const from = await promptForEnvironment({ message: "Clone FROM which source?" });
  const to = await promptForEnvironment({ message: "Clone TO which destination?" });

  const missingEnvVars = [...new Set(
    [from, to].flatMap((env) => Object.values(env.envVars)).filter((envVar) => !envVar.value).map((envVar) => envVar.name),
  )];
  if (missingEnvVars.length) {
    throw new Error(`Missing required env var(s): ${missingEnvVars.join(", ")}`);
  }

  const fromOrgSlug = await promptForOrgSlug(from, "From");

    const formId = await input({ message: "Cloning Form ID:" });

  if (!formId) {
    console.error("Form ID is required to create a form, exiting.");
    return;
  }
  const toOrgSlug = await promptForOrgSlug(to, "To");

  console.log(
    `\nCloning form ${formId} from ${from.label} (${fromOrgSlug}) to ${to.label} (${toOrgSlug})...`,
  );

  const { id: newFormId, url: newFormUrl } = await createLocalForm({
    formId,
    source: {
      orgSlug: fromOrgSlug,
      baseUrl: from.baseUrl,
      plToken: from.envVars.plToken.value,
    },
    destination: {
      orgSlug: toOrgSlug,
      baseUrl: to.baseUrl,
      plToken: to.envVars.plToken.value,
    },
  });
  if (!newFormId || !newFormUrl) {
    console.error("Failed to create form");
    return;
  }
  console.log(`✅ Form created with ID ${newFormId} at URL: ${newFormUrl}`);

  console.log("\nDone!");
}

main();
