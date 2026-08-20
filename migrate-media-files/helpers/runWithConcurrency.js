// Runs a worker function on a list of items with a specified concurrency limit
// Returns an object with an `abort` method to stop further processing
export function runWithConcurrency(items, concurrency, worker) {
  let index = 0;
  let aborted = false;

  async function next() {
    while (!aborted) {
      const current = index++;
      if (current >= items.length) return;
      await worker(items[current], current);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => next(),
  );
  const done = Promise.all(workers);

  return {
    abort: () => {
      aborted = true;
    },
    done,
  };
}
