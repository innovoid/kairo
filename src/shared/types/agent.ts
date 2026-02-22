import type { AiProvider } from './settings';

export type AgentRunStatus =
  | 'planning'
  | 'awaiting_approval'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'blocked';

export type AgentStepStatus =
  | 'pending'
  | 'awaiting_approval'
  | 'running'
  | 'done'
  | 'failed'
  | 'blocked'
  | 'skipped';

export type AgentRiskLevel = 'safe' | 'needs_privilege' | 'destructive' | 'unknown';

export interface HostFacts {
  os: string;
  distro: string;
  version: string;
  packageManager: string;
  isRoot: boolean;
  sudoAvailable: boolean;
  systemdAvailable: boolean;
  updatedAt: string;
}

export interface AgentStep {
  id: string;
  index: number;
  title: string;
  command: string;
  verifyCommand?: string;
  status: AgentStepStatus;
  risk: AgentRiskLevel;
  requiresDoubleConfirm: boolean;
  outputSummary?: string;
  exitCode?: number;
  error?: string;
  startedAt?: string;
  endedAt?: string;
}

export interface AgentRun {
  id: string;
  sessionId: string;
  workspaceId?: string;
  hostId?: string;
  hostLabel?: string;
  task: string;
  status: AgentRunStatus;
  steps: AgentStep[];
  facts?: HostFacts;
  createdAt: string;
  updatedAt: string;
  summary?: string;
  lastError?: string;
}

export interface AgentEvent {
  id: string;
  runId: string;
  stepId?: string;
  type: 'info' | 'warning' | 'error' | 'approval' | 'execution' | 'verification';
  message: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export interface StartAgentRunInput {
  sessionId: string;
  task: string;
  hostId?: string;
  hostLabel?: string;
  workspaceId?: string;
  provider: AiProvider;
  model: string;
  apiKey: string;
}

export interface ApproveAgentStepInput {
  runId: string;
  stepId: string;
  elevate?: boolean;
  doubleConfirm?: boolean;
}

export interface RejectAgentStepInput {
  runId: string;
  stepId: string;
  reason?: string;
}

export interface CancelAgentRunInput {
  runId: string;
}

export interface SavePlaybookInput {
  workspaceId?: string;
  runId: string;
  name: string;
}

export interface AgentPlaybook {
  id: string;
  workspaceId?: string;
  name: string;
  task: string;
  sourceRunId?: string;
  steps: Array<{
    title: string;
    command: string;
    verifyCommand?: string;
  }>;
  createdAt: string;
}

export interface AgentStepOutputEvent {
  runId: string;
  stepId: string;
  chunk: string;
}
