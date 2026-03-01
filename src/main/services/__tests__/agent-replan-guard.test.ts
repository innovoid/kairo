import { describe, expect, it } from 'vitest';
import {
  MAX_CONSECUTIVE_NO_PROGRESS_REPLANS,
  MAX_REPLANS_PER_RUN,
  evaluateReplanCircuitBreaker,
  type ReplanGuardState,
} from '../agent-replan-guard';

function step(command: string, verifyCommand?: string) {
  return { command, verifyCommand };
}

describe('agent-replan-guard', () => {
  it('allows replans under configured limits', () => {
    const decision = evaluateReplanCircuitBreaker(
      undefined,
      [step('ls -la')],
      [step('df -h')],
    );

    expect(decision.allowed).toBe(true);
    expect(decision.nextState.totalReplans).toBe(1);
    expect(decision.nextState.consecutiveNoProgressReplans).toBe(0);
  });

  it('blocks when total replans exceed max', () => {
    const state: ReplanGuardState = {
      totalReplans: MAX_REPLANS_PER_RUN,
      consecutiveNoProgressReplans: 0,
      lastReplanFingerprint: 'a',
    };
    const decision = evaluateReplanCircuitBreaker(
      state,
      [step('echo current')],
      [step('echo next')],
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('Replan limit reached');
  });

  it('blocks repeated no-progress replans', () => {
    const samePlan = [step('apt-get update'), step('apt-get install -y nginx')];
    const first = evaluateReplanCircuitBreaker(undefined, samePlan, samePlan);
    const second = evaluateReplanCircuitBreaker(first.nextState, samePlan, samePlan);
    const third = evaluateReplanCircuitBreaker(second.nextState, samePlan, samePlan);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.reason).toContain('Repeated no-progress replans detected');
    expect(third.nextState.consecutiveNoProgressReplans).toBe(MAX_CONSECUTIVE_NO_PROGRESS_REPLANS + 1);
  });

  it('resets no-progress counter when replan materially changes', () => {
    const stale = [step('echo hello')];
    const fresh = [step('uptime')];
    const first = evaluateReplanCircuitBreaker(undefined, stale, stale);
    const second = evaluateReplanCircuitBreaker(first.nextState, stale, fresh);

    expect(first.nextState.consecutiveNoProgressReplans).toBe(1);
    expect(second.allowed).toBe(true);
    expect(second.nextState.consecutiveNoProgressReplans).toBe(0);
  });
});

