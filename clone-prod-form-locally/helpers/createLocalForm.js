import { createLocalIntegration } from "./createLocalIntegration.js";
import { confirm } from "@inquirer/prompts";

const keepFormPropKeys = [
  "title",
  "fields",
  "submitButtonLabel",
  "multistepFormSettings",
];

export async function createLocalForm(orgSlug, formId, targetCMS, { qaUrl } = {}) {
  const formEndpoint = `https://truspeed.io/${orgSlug}/api/forms/${formId}`;

  const targetTruSpeedUrl =
    targetCMS === "qa"
      ? qaUrl
      : process.env.LOCAL_TRUSPEED_URL || "http://localhost:4000";
  const targetTruspeedOrg = targetCMS === "qa" ? process.env.QA_TRUSPEED_ORG_SLUG : process.env.LOCAL_TRUSPEED_ORG_SLUG || "localhost";

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

  const integrationConfigs = {
    formIntegration:
      typeof formRes?.formIntegration === "string"
        ? formRes.formIntegration
        : formRes?.formIntegration?.id,
    secondFormIntegration:
      typeof formRes?.secondFormIntegration === "string"
        ? formRes.secondFormIntegration
        : formRes?.secondFormIntegration?.id,
    metaIntegration:
      typeof formRes?.metaIntegration === "string"
        ? formRes.metaIntegration
        : formRes?.metaIntegration?.id,
    marlimarIntegration:
      typeof formRes?.marlimarIntegration === "string"
        ? formRes.marlimarIntegration
        : formRes?.marlimarIntegration?.id,
    hatchIntegration:
      typeof formRes?.hatchIntegration === "string"
        ? formRes.hatchIntegration
        : formRes?.hatchIntegration?.id,
  };

  const localIntegrationConfigs = {
    integration: null,
    secondFormIntegration: null,
    metaIntegration: null,
    marlimarIntegration: null,
    hatchIntegration: null,
  };

  //   if original form integrations, we want to make that too
  for (const [key, originalIntegrationId] of Object.entries(
    integrationConfigs,
  )) {
    if (originalIntegrationId) {
      // prompt user if they want to create the integration as well
      const createIntegration = await confirm({
        message: `This form has ${key}. Do you want to clone that integration locally too?`,
      });

      if (createIntegration) {
        const createdIntegration = await createLocalIntegration(
          orgSlug,
          originalIntegrationId,
          `${targetTruSpeedUrl}/${targetTruspeedOrg}`,
        );
        if (createdIntegration?.id) {
          localIntegrationConfigs[key] = createdIntegration.id;
        } else {
          console.error(
            `Failed to create local integration for original integration with ID ${originalIntegrationId}. Proceeding without an integration.`,
          );
        }
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

  // if have any integrations, add the first one to the form (we can only add one integration when creating the form, so we prioritize the main "formIntegration" and then fallback to the others if that one doesn't exist)
  Object.entries(localIntegrationConfigs).forEach(
    ([key, localIntegrationId]) => {
      if (localIntegrationId) cleanedForm[key] = localIntegrationId;
    },
  );

  const destinationCrmUrl = `${targetTruSpeedUrl}/${targetTruspeedOrg}`;
  const destinationCrmApiUrl = `${destinationCrmUrl}/api/forms`;

  console.log(`Destination CRM URL: ${destinationCrmUrl}`);

  const postRes = await fetch(destinationCrmApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `users API-Key ${process.env.QA_PL_TOKEN}`,
    },
    body: JSON.stringify(cleanedForm),
  });
  const postResBody = await postRes.json();

  const newFormId = postResBody?.doc?.id;
  const newFormUrl = `${destinationCrmUrl}/admin/collections/forms/${newFormId}`;

  return {
    id: newFormId,
    url: newFormUrl,
  };
}
