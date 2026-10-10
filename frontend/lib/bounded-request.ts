/** Bound authentication, transport and response decoding; never retry writes automatically. */
export async function boundedRequest<T>(
  work: (signal: AbortSignal) => Promise<T>,
  mutation: boolean,
  timeoutMs = 30000,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work(controller.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              mutation
                ? "The request timed out. It may have been saved. Reload and check before trying again."
                : "The request timed out. Check your connection and try again.",
            ),
          );
          controller.abort();
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
