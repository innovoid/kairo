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
  /** One-sentence plain-English explanation of what this command does and why */
  explain?: string;
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
  /** Full conversation thread — user messages + AI analysis messages */
  messages: AgentMessage[];
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

export interface RunPlaybookInput {
  playbookId?: string;
  playbookName?: string;
  sessionId: string;
  workspaceId?: string;
  hostId?: string;
  hostLabel?: string;
}

export interface AgentPlaybook {
  id: string;
  workspaceId?: string;
  name: string;
  task: string;
  sourceRunId?: string;
  steps: Array<{
    title: string;
    explain?: string;
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

// ── Conversational agent message types ────────────────────────────────────────

/** A single message in the agent conversation thread */
export type AgentMessageRole = 'user' | 'assistant';

export interface AgentMessage {
  id: string;
  role: AgentMessageRole;
  /** Plain text / markdown content for user and assistant messages */
  content: string;
  /** If this message carries a proposed plan (assistant only) */
  plan?: AgentStep[];
  /** Which step this message is the post-execution analysis for */
  stepResultId?: string;
  /** Whether the AI is still streaming this message */
  streaming?: boolean;
  /** If set, the message represents a failed AI call — rendered as a red error card */
  error?: string;
  createdAt: string;
}

/** Sent from main → renderer while the AI is streaming an assistant message */
export interface AgentMessageChunkEvent {
  runId: string;
  messageId: string;
  chunk: string;
}

/** Sent from main → renderer when an assistant message finishes streaming */
export interface AgentMessageDoneEvent {
  runId: string;
  messageId: string;
}

/** Input for a user follow-up message mid-run */
export interface AgentChatInput {
  runId: string;
  content: string;
  provider: AiProvider;
  model: string;
  apiKey: string;
}
