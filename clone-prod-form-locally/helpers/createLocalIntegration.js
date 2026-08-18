const removeFormIntegrationPropKeys = [
  "id",
  "createdAt",
  "updatedAt",
  "tenant",
];

export async function createLocalIntegration({ integrationId, source, destination }) {
  const formEndpoint = `${source.baseUrl}/${source.orgSlug}/api/form-integrations/${integrationId}`;

  console.log(`Fetching integration: ${formEndpoint}`);
  const res = await fetch(formEndpoint, {
    headers: {
      Authorization: `users API-Key ${source.plToken}`,
    },
  });

  if (!res.ok) {
    console.error(`Failed to fetch integration with ID ${integrationId} for org ${source.orgSlug}: ${res.status} ${res.statusText}`);
    return null;
  }

  const integrationRes = await res.json();

  if (!integrationRes) {
    console.error(integrationRes);
    throw new Error(`No details found for integration with ID ${integrationId} for org ${source.orgSlug}`);
  }

  const cleanedFormIntegration = Object.fromEntries(
    Object.entries(integrationRes).filter(
      ([key]) => !removeFormIntegrationPropKeys.includes(key),
    ),
  );

  cleanedFormIntegration["title"] =
    `[Imported] | ${cleanedFormIntegration["title"]} | ${source.orgSlug}`;

  const destinationCrmUrl = `${destination.baseUrl}/${destination.orgSlug}`;
  const destinationCrmApiUrl = `${destinationCrmUrl}/api/form-integrations`;

  // log creating integration
  console.log(
    `Creating local integration with title: ${cleanedFormIntegration["title"]} at ${destinationCrmUrl}...`,
  );

  //  post to local crm
  const postRes = await fetch(destinationCrmApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `users API-Key ${destination.plToken}`,
    },
    body: JSON.stringify(cleanedFormIntegration),
  });
  const postResBody = await postRes.json();

  const newIntegrationId = postResBody?.doc?.id;
  const newIntegrationUrl = `${destinationCrmUrl}/admin/collections/form-integrations/${newIntegrationId}`;


  return {id: postResBody?.doc?.id, url: newIntegrationUrl};
  //
}
