export type UnknownHostPromptOutcome = 'accepted' | 'rejected' | 'timeout' | 'error';

export async function resolveUnknownHostPrompt(
  showDialog: () => Promise<{ response: number }>,
  timeoutMs: number
): Promise<UnknownHostPromptOutcome> {
  return await new Promise((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve('timeout');
    }, timeoutMs);

    void showDialog()
      .then((result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(result.response === 0 ? 'accepted' : 'rejected');
      })
      .catch(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve('error');
      });
  });
}
