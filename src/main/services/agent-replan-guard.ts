import type { AgentStep } from '../../shared/types/agent';

export interface ReplanGuardState {
  totalReplans: number;
  consecutiveNoProgressReplans: number;
  lastReplanFingerprint?: string;
}

export interface ReplanGuardDecision {
  allowed: boolean;
  reason?: string;
  nextState: ReplanGuardState;
}

interface FingerprintStep {
  command: string;
  verifyCommand?: string;
}

export const MAX_REPLANS_PER_RUN = 6;
export const MAX_CONSECUTIVE_NO_PROGRESS_REPLANS = 2;

function normalizeCommand(command: string | undefined): string {
  if (!command) return '';
  return command.trim().replace(/\s+/g, ' ').toLowerCase();
}

function planFingerprint(steps: FingerprintStep[]): string {
  return steps
    .map((step) => `${normalizeCommand(step.command)}|${normalizeCommand(step.verifyCommand)}`)
    .join('||');
}

function toFingerprintSteps(steps: Array<AgentStep | FingerprintStep>): FingerprintStep[] {
  return steps.map((step) => ({ command: step.command, verifyCommand: step.verifyCommand }));
}

export function evaluateReplanCircuitBreaker(
  previous: ReplanGuardState | undefined,
  currentPendingSteps: Array<AgentStep | FingerprintStep>,
  replannedSteps: Array<AgentStep | FingerprintStep>
): ReplanGuardDecision {
  const prevState: ReplanGuardState = previous ?? {
    totalReplans: 0,
    consecutiveNoProgressReplans: 0,
    lastReplanFingerprint: undefined,
  };

  const currentFingerprint = planFingerprint(toFingerprintSteps(currentPendingSteps));
  const nextFingerprint = planFingerprint(toFingerprintSteps(replannedSteps));
  const isNoProgress =
    nextFingerprint.length > 0 &&
    (nextFingerprint === currentFingerprint || nextFingerprint === prevState.lastReplanFingerprint);

  const nextState: ReplanGuardState = {
    totalReplans: prevState.totalReplans + 1,
    consecutiveNoProgressReplans: isNoProgress ? prevState.consecutiveNoProgressReplans + 1 : 0,
    lastReplanFingerprint: nextFingerprint || prevState.lastReplanFingerprint,
  };

  if (nextState.totalReplans > MAX_REPLANS_PER_RUN) {
    return {
      allowed: false,
      reason: `Replan limit reached (${MAX_REPLANS_PER_RUN}). Start a new run to continue safely.`,
      nextState,
    };
  }

  if (nextState.consecutiveNoProgressReplans > MAX_CONSECUTIVE_NO_PROGRESS_REPLANS) {
    return {
      allowed: false,
      reason: 'Repeated no-progress replans detected. Provide new instructions or start a fresh run.',
      nextState,
    };
  }

  return { allowed: true, nextState };
}

