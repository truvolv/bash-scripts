const removeFormIntegrationPropKeys = [
  "id",
  "createdAt",
  "updatedAt",
  "tenant",
];

export async function createLocalIntegration(orgSlug, integrationId, cmsUrl) {
  const formEndpoint = `https://truspeed.io/${orgSlug}/api/form-integrations/${integrationId}`;

  // check if have the required env vars
  if (!process.env.PROD_PL_TOKEN || !process.env.LOCAL_PL_TOKEN) {
    throw new Error(
      "Missing required env var: PROD_PL_TOKEN or LOCAL_PL_TOKEN",
    );
  }


  console.log(`Fetching integration: ${formEndpoint}`);
  const res = await fetch(formEndpoint, {
    headers: {
      Authorization: `users API-Key ${process.env.PROD_PL_TOKEN}`,
    },
  });

  if (!res.ok) {
    console.error(`Failed to fetch integration with ID ${integrationId} for org ${orgSlug}: ${res.status} ${res.statusText}`);
    return null;
  }

  const integrationRes = await res.json();

  console.log("Integration response from server: ", integrationRes);

  if (!integrationRes) {
    console.error(integrationRes);
    throw new Error(`No details found for integration with ID ${integrationId} for org ${orgSlug}`);
  }

  const cleanedFormIntegration = Object.fromEntries(
    Object.entries(integrationRes).filter(
      ([key]) => !removeFormIntegrationPropKeys.includes(key),
    ),
  );

  cleanedFormIntegration["title"] =
    `[Imported] | ${cleanedFormIntegration["title"]} | ${orgSlug}`;

    // remove partner integration if exists
  if (cleanedFormIntegration["partnerIntegration"]) {
    delete cleanedFormIntegration["partnerIntegration"];
    console.warn("Removed partnerIntegration from integration before creating local integration.");
  }

  const destinationCrmApiUrl = `${cmsUrl}/api/form-integrations`;

  // log creating integration
  console.log(
    `Creating local integration with title: ${cleanedFormIntegration["title"]} at ${destinationCrmApiUrl}...`,
  );

  //  post to local crm
  const postRes = await fetch(destinationCrmApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `users API-Key ${process.env.QA_PL_TOKEN}`,
    },
    body: JSON.stringify(cleanedFormIntegration),
  });
  const postResBody = await postRes.json();

  console.log("Response from creating local integration: ", postResBody);

  const newIntegrationId = postResBody?.doc?.id;
  const newIntegrationUrl = `${destinationCrmApiUrl}/admin/collections/form-integrations/${newIntegrationId}`;


  return {id: postResBody?.doc?.id, url: newIntegrationUrl};
  //
}
