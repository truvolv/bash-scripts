import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { log } from "./logging.js";

// Lists all objects in a DigitalOcean Spaces bucket, handling pagination
// Returns an array of objects with `key` and `size`.
export async function listAllDOObjects(s3, bucket, logStream) {
  const objects = [];
  let continuationToken = undefined;
  let page = 0;

  do {
    page++;
    const result = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }),
    );

    const batch = (result.Contents ?? []).map((obj) => ({
      key: obj.Key,
      size: obj.Size ?? 0,
    }));
    objects.push(...batch);
    continuationToken = result.IsTruncated
      ? result.NextContinuationToken
      : undefined;

    log(
      "INFO",
      `DO Spaces page`,
      {
        page,
        batchSize: batch.length,
        totalSoFar: objects.length,
      },
      logStream,
    );
  } while (continuationToken);

  return objects;
}
