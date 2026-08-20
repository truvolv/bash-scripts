// Parse command-line arguments and return an object with the parsed values
export function getCliArgs(argv) {
  let args = {
    dryRun: false,
    concurrency: 10,
    batchSize: 50,
    useListCheck: false,
  };

  for (const raw of argv.slice(2)) {
    if (raw === "--dry-run") {
      args.dryRun = true;
    } else if (raw === "--use-list-check") {
      args.useListCheck = true;
    } else if (raw.startsWith("--concurrency=")) {
      const val = Number(raw.split("=")[1]);
      if (!Number.isInteger(val) || val < 1) {
        throw new Error(`Invalid --concurrency value: ${raw}`);
      }
      args.concurrency = val;
    } else if (raw.startsWith("--batch-size=")) {
      const val = Number(raw.split("=")[1]);
      if (!Number.isInteger(val) || val < 1) {
        throw new Error(`Invalid --batch-size value: ${raw}`);
      }
      args.batchSize = val;
    } else {
      throw new Error(`Unrecognized argument: ${raw}`);
    }
  }

  return args;
}
