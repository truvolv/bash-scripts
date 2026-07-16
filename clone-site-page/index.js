import { input } from "@inquirer/prompts";
import * as dotenv from "dotenv";
import path from "path";
import { identifyCollection } from "./helpers/identifyCollection.js";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// const config = {
//   readPageId: "68a5293b35e6e064a7890114",
//   readPageOrgSlug: "demo",
//   endpoint: "https://truspeed.io",
// };

const localConfig = {
  readPageId: "6a04aa6669fb715da50ea7de",
  readPageOrgSlug: "localhost",
  endpoint: "http://localhost:4000",
};
const pagesEndpoint = `${localConfig.endpoint}/${localConfig.readPageOrgSlug}/api/pages/${localConfig.readPageId}?depth=4`;

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

  const targetSiteId = await input({ message: "Target site ID:" });

  const res = await fetch(pagesEndpoint, {
    headers: {
      Authorization: `users API-Key ${process.env.LOCAL_PL_TOKEN}`,
    },
  });
  const pageRes = await res.json();

  if (!pageRes) {
    console.error(
      `No page or fields found for page with ID ${localConfig.readPageId} for org ${localConfig.readPageOrgSlug}`,
    );
    console.log("Response from server: ", pageRes);
    return null;
  }

  const updatedPageData = {
    ...pageRes,
    sites: [targetSiteId], // replace with target site ID
  }

  console.log("Updated page data to send to target CMS: ", updatedPageData);

  const 

  //   console.log("Page response: ", pageRes);

  // recursively iterate over all keys and identify any keys where the value is an object with an "id" key, and print out the key and the id value
  // function findTopLevelRelationships(obj, parentKey = "") {
  //   for (const [key, value] of Object.entries(obj)) {
  //   //   console.log(`Checking key: ${parentKey}${key}`, value);
  //     // console.log(`Checking key: ${parentKey}${key}`);
  //     if (Array.isArray(value)) {
  //       // console.log(`Found array key: ${parentKey}${key}`);
  //       value.forEach((item, index) => {
  //         if (item && typeof item === "object") {
  //           delete item["id"]; // remove id to avoid false positives
  //           // console.log(
  //           //   "Checking array item at index ",
  //           //   index,
  //           //   " for key: ",
  //           //   `${parentKey}${key}[${index}]`,
  //           //   item,
  //           // );
  //           findTopLevelRelationships(item, `${parentKey}${key}[${index}].`);
  //         }
  //       });
  //     } else if (value && typeof value === "object") {
  //       if (value.id && key !== 'tenant') {
  //         console.log(`Found id key: ${parentKey}${key} with id: ${value.id}`);
  //         console.log("\tPotential collections: ", identifyCollection(value));
  //       } else {
  //         findTopLevelRelationships(value, `${parentKey}${key}.`);
  //       }
  //     }
  //   }
  // }

  // findTopLevelRelationships(pageRes);
}

main();
