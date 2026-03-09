import { createLocalIntegration, } from "./createLocalIntegration.js";
import { confirm } from "@inquirer/prompts";

const keepFormPropKeys = [
  "title",
  "fields",
  "submitButtonLabel",
  "multistepFormSettings",
];

export async function createLocalForm(orgSlug, formId) {
  const formEndpoint = `https://truspeed.io/${orgSlug}/api/forms/${formId}`;

  const localTruSpeedUrl =
    process.env.LOCAL_TRUSPEED_URL || "http://localhost:4000";
  const localTruSpeedOrg = process.env.LOCAL_TRUSPEED_ORG || "localhost";

  console.log(`Fetching form: ${formEndpoint}`);
  const res = await fetch(formEndpoint, {
    headers: {
      Authorization: `users API-Key ${process.env.PROD_PL_TOKEN}`,
    },
  });
  const formRes = await res.json();

  if (!formRes || !formRes?.fields) {
    console.error(
      `No form or fields found for form with ID ${formId} for org ${orgSlug}`,
    );
    console.log("Response from server: ", formRes);
    return null;
  }

  //   if original form had an integration, we want to make that too
  const originalIntegrationId =
    typeof formRes?.formIntegration === "string"
      ? formRes.formIntegration
      : formRes?.formIntegration?.id;
  let localIntegrationId = null;
  if (originalIntegrationId) {
    // prompt user if they want to create the integration as well
    const createIntegration = await confirm({message: 'This form has an integration. Do you want to clone that locally too?'});

    if (createIntegration) {
      const createdIntegration = await createLocalIntegration(
        orgSlug,
        originalIntegrationId,
      );
      if (createdIntegration?.id) {
        localIntegrationId = createdIntegration.id;
      } else {
        console.error(
          `Failed to create local integration for original integration with ID ${originalIntegrationId}. Proceeding without an integration.`,
        );
      }
    }
  }

  const cleanedForm = Object.fromEntries(
    Object.entries(formRes).filter(([key]) => keepFormPropKeys.includes(key)),
  );
  // Add "emails": []
  cleanedForm["emails"] = [];
  // setup confirmation message
  cleanedForm["confirmationType"] = "message";
  cleanedForm["confirmationMessage"] = [
    {
      children: [
        {
          text: "Thank you! Your message has been sent.",
        },
      ],
    },
  ];
  cleanedForm["title"] = `[Imported] | ${cleanedForm["title"]} | ${orgSlug}`;

  if (localIntegrationId) {
    cleanedForm["formIntegration"] = localIntegrationId;
  }

  const destinationCrmUrl = `${localTruSpeedUrl}/${localTruSpeedOrg}`;
  const destinationCrmApiUrl = `${destinationCrmUrl}/api/forms`;

  console.log(`Destination CRM URL: ${destinationCrmUrl}`);

  const postRes = await fetch(destinationCrmApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `users API-Key ${process.env.LOCAL_PL_TOKEN}`,
    },
    body: JSON.stringify(cleanedForm),
  });
  const postResBody = await postRes.json();

  const newFormId = postResBody?.doc?.id;
  const newFormUrl = `${destinationCrmUrl}/admin/collections/forms/${newFormId}`;

  const integrationUrl = localIntegrationId
    ? `${destinationCrmUrl}/admin/collections/form-integrations/${localIntegrationId}`
    : undefined;

  return {
    id: newFormId,
    url: newFormUrl,
    integrationId: localIntegrationId,
    integrationUrl,
  };
}
