export async function fetchOrganizations({ baseUrl, plToken }) {
  const orgs = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `${baseUrl}/api/organizations?limit=100&depth=0&sort=name&page=${page}`,
      {
        headers: {
          Authorization: `users API-Key ${plToken}`,
        },
      },
    );

    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }

    const body = await res.json();
    orgs.push(...(body?.docs || []));

    if (!body?.hasNextPage) break;
    page += 1;
  }

  return orgs;
}
