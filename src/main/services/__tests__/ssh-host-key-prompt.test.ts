import { describe, expect, it, vi } from 'vitest';
import { resolveUnknownHostPrompt } from '../ssh-host-key-prompt';

describe('resolveUnknownHostPrompt', () => {
  it('returns accepted when dialog response is accept', async () => {
    const outcome = await resolveUnknownHostPrompt(async () => ({ response: 0 }), 50);
    expect(outcome).toBe('accepted');
  });

  it('returns rejected when dialog response is cancel', async () => {
    const outcome = await resolveUnknownHostPrompt(async () => ({ response: 1 }), 50);
    expect(outcome).toBe('rejected');
  });

  it('returns timeout when dialog never resolves', async () => {
    vi.useFakeTimers();
    const pendingDialog = () => new Promise<{ response: number }>(() => {});
    const outcomePromise = resolveUnknownHostPrompt(pendingDialog, 25);
    await vi.advanceTimersByTimeAsync(30);
    await expect(outcomePromise).resolves.toBe('timeout');
    vi.useRealTimers();
  });

  it('returns error when dialog rejects', async () => {
    const outcome = await resolveUnknownHostPrompt(async () => {
      throw new Error('dialog failed');
    }, 50);
    expect(outcome).toBe('error');
  });
});
