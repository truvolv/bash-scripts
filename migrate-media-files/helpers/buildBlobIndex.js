import { list } from "@vercel/blob";
import { log } from "./logging.js";

// Builds an index of all blobs in the Vercel Blob store, keyed by pathname, with their sizes
export async function buildBlobIndex(token, logStream) {
  const index = new Map();
  let cursor = undefined;
  let page = 0;

  do {
    page++;
    const result = await list({ token, cursor, limit: 1000 });

    for (const blob of result.blobs) {
      index.set(blob.pathname, blob.size);
    }
    cursor = result.hasMore ? result.cursor : undefined;

    log(
      "INFO",
      `Listed Blob store page`,
      {
        page,
        batchSize: result.blobs.length,
        totalSoFar: index.size,
      },
      logStream,
    );
  } while (cursor);

  return index;
}
