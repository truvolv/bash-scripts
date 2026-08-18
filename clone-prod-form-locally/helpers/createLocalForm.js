import { createLocalIntegration, } from "./createLocalIntegration.js";
import { confirm } from "@inquirer/prompts";

const keepFormPropKeys = [
  "title",
  "fields",
  "submitButtonLabel",
  "multistepFormSettings",
];

export async function createLocalForm({ formId, source, destination }) {
  const formEndpoint = `${source.baseUrl}/${source.orgSlug}/api/forms/${formId}`;

  console.log(`Fetching form: ${formEndpoint}`);
  const res = await fetch(formEndpoint, {
    headers: {
      Authorization: `users API-Key ${source.plToken}`,
    },
  });
  const formRes = await res.json();

  if (!formRes || !formRes?.fields) {
    console.error(
      `No form or fields found for form with ID ${formId} for org ${source.orgSlug}`,
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
      const createdIntegration = await createLocalIntegration({
        integrationId: originalIntegrationId,
        source,
        destination,
      });
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
  cleanedForm["title"] = `[Imported] | ${cleanedForm["title"]} | ${source.orgSlug}`;

  if (localIntegrationId) {
    cleanedForm["formIntegration"] = localIntegrationId;
  }

  const destinationCrmUrl = `${destination.baseUrl}/${destination.orgSlug}`;
  const destinationCrmApiUrl = `${destinationCrmUrl}/api/forms`;

  console.log(`Destination CRM URL: ${destinationCrmUrl}`);

  const postRes = await fetch(destinationCrmApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `users API-Key ${destination.plToken}`,
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
