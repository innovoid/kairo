import type { WebContents } from 'electron';
import {
  agentEventQueries,
  agentPlaybookQueries,
  agentRunQueries,
  agentStepQueries,
} from '../db';
import {
  applyElevation,
  classifyCommandRisk,
  requiresDoubleConfirm,
} from './agent-command-policy';
import { agentFactsService } from './agent-facts';
import { aiProxy } from './ai-proxy';
import { executeShellCommand } from './session-command-executor';
import type {
  AgentPlaybook,
  AgentRun,
  AgentRiskLevel,
  AgentStep,
  ApproveAgentStepInput,
  HostFacts,
  SavePlaybookInput,
  StartAgentRunInput,
} from '../../shared/types/agent';

interface PlannedStep {
  title: string;
  command: string;
  verifyCommand?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function jsonSafeParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function extractJsonObject(raw: string): string {
  const stripped = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  const firstBrace = stripped.indexOf('{');
  const lastBrace = stripped.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace >= 0 && lastBrace > firstBrace) {
    return stripped.slice(firstBrace, lastBrace + 1);
  }
  return stripped;
}

function toSummary(text: string): string {
  const compact = text.replace(/\x1b\[[0-9;]*m/g, '').trim();
  return compact.length > 1200 ? `${compact.slice(0, 1200)}...` : compact;
}

function buildPlannerSystemPrompt(facts: HostFacts): string {
  return [
    'You are an infrastructure operations planner for SSH tasks.',
    'Create a concise step-by-step shell plan that is safe and verifiable.',
    'Return strict JSON only. No markdown, no prose.',
    'JSON schema: {"steps":[{"title":"...","command":"...","verifyCommand":"..."}]}',
    `Host facts: os=${facts.os}, distro=${facts.distro}, version=${facts.version}, packageManager=${facts.packageManager}, isRoot=${facts.isRoot}, sudoAvailable=${facts.sudoAvailable}, systemdAvailable=${facts.systemdAvailable}`,
    'Prefer idempotent commands where possible.',
    'For package installs include a verifyCommand.',
    'Do not include dangerous destructive commands unless explicitly requested by user intent.',
  ].join('\n');
}

function fallbackPlan(task: string, facts: HostFacts): PlannedStep[] {
  const lowerTask = task.toLowerCase();
  if (lowerTask.includes('docker')) {
    if (facts.packageManager === 'apt' || facts.packageManager === 'apt-get') {
      return [
        {
          title: 'Update apt package index',
          command: 'apt-get update',
        },
        {
          title: 'Install Docker engine',
          command: 'apt-get install -y docker.io',
          verifyCommand: 'docker --version',
        },
        {
          title: 'Enable and start Docker service',
          command: 'systemctl enable --now docker',
          verifyCommand: 'systemctl is-active docker',
        },
      ];
    }

    if (facts.packageManager === 'dnf' || facts.packageManager === 'yum') {
      return [
        {
          title: 'Install Docker package',
          command: `${facts.packageManager} install -y docker`,
          verifyCommand: 'docker --version',
        },
        {
          title: 'Enable and start Docker service',
          command: 'systemctl enable --now docker',
          verifyCommand: 'systemctl is-active docker',
        },
      ];
    }

    if (facts.packageManager === 'pacman') {
      return [
        {
          title: 'Install Docker package',
          command: 'pacman -Sy --noconfirm docker',
          verifyCommand: 'docker --version',
        },
        {
          title: 'Enable and start Docker service',
          command: 'systemctl enable --now docker',
          verifyCommand: 'systemctl is-active docker',
        },
      ];
    }
  }

  return [
    {
      title: 'Run requested task',
      command: task,
    },
  ];
}

function sanitizePlannedSteps(rawSteps: PlannedStep[], facts: HostFacts): AgentStep[] {
  const steps = rawSteps
    .filter((step) => step.command?.trim())
    .slice(0, 12)
    .map((step, index) => {
      const risk = classifyCommandRisk(step.command, facts);
      return {
        id: crypto.randomUUID(),
        index,
        title: step.title?.trim() || `Step ${index + 1}`,
        command: step.command.trim(),
        verifyCommand: step.verifyCommand?.trim() || undefined,
        status: 'pending',
        risk,
        requiresDoubleConfirm: requiresDoubleConfirm(risk),
      } satisfies AgentStep;
    });

  if (steps.length === 0) {
    return [
      {
        id: crypto.randomUUID(),
        index: 0,
        title: 'Run requested task',
        command: 'echo "No plan generated"',
        status: 'pending',
        risk: 'unknown',
        requiresDoubleConfirm: false,
      },
    ];
  }

  return steps;
}

function emitRun(sender: WebContents, run: AgentRun): void {
  if (!sender.isDestroyed()) {
    sender.send('agent:run-updated', run);
  }
}

function emitStepOutput(sender: WebContents, runId: string, stepId: string, chunk: string): void {
  if (!sender.isDestroyed()) {
    sender.send('agent:step-output', { runId, stepId, chunk });
  }
}

function persistRun(run: AgentRun): void {
  agentRunQueries.upsert({
    id: run.id,
    session_id: run.sessionId,
    workspace_id: run.workspaceId ?? null,
    host_id: run.hostId ?? null,
    host_label: run.hostLabel ?? null,
    task: run.task,
    status: run.status,
    facts: run.facts ? JSON.stringify(run.facts) : null,
    summary: run.summary ?? null,
    last_error: run.lastError ?? null,
    created_at: new Date(run.createdAt).getTime(),
    updated_at: new Date(run.updatedAt).getTime(),
  });

  agentStepQueries.replaceForRun(
    run.id,
    run.steps.map((step) => ({
      id: step.id,
      run_id: run.id,
      step_index: step.index,
      title: step.title,
      command: step.command,
      verify_command: step.verifyCommand ?? null,
      status: step.status,
      risk: step.risk,
      requires_double_confirm: step.requiresDoubleConfirm ? 1 : 0,
      output_summary: step.outputSummary ?? null,
      exit_code: step.exitCode ?? null,
      error: step.error ?? null,
      started_at: step.startedAt ? new Date(step.startedAt).getTime() : null,
      ended_at: step.endedAt ? new Date(step.endedAt).getTime() : null,
    }))
  );
}

function appendEvent(runId: string, type: string, message: string, stepId?: string, payload?: Record<string, unknown>): void {
  agentEventQueries.insert({
    id: crypto.randomUUID(),
    run_id: runId,
    step_id: stepId ?? null,
    type,
    message,
    payload: payload ? JSON.stringify(payload) : null,
    created_at: Date.now(),
  });
}

const runCache = new Map<string, AgentRun>();

function ensureRun(runId: string): AgentRun {
  const cached = runCache.get(runId);
  if (cached) return cached;

  const runRow = agentRunQueries.getById(runId);
  if (!runRow) {
    throw new Error(`Run not found: ${runId}`);
  }

  const stepRows = agentStepQueries.listByRun(runId);
  const run: AgentRun = {
    id: runRow.id,
    sessionId: runRow.session_id,
    workspaceId: runRow.workspace_id ?? undefined,
    hostId: runRow.host_id ?? undefined,
    hostLabel: runRow.host_label ?? undefined,
    task: runRow.task,
    status: runRow.status as AgentRun['status'],
    steps: stepRows
      .sort((a, b) => a.step_index - b.step_index)
      .map((row) => ({
        id: row.id,
        index: row.step_index,
        title: row.title,
        command: row.command,
        verifyCommand: row.verify_command ?? undefined,
        status: row.status as AgentStep['status'],
        risk: row.risk as AgentRiskLevel,
        requiresDoubleConfirm: row.requires_double_confirm === 1,
        outputSummary: row.output_summary ?? undefined,
        exitCode: row.exit_code ?? undefined,
        error: row.error ?? undefined,
        startedAt: row.started_at ? new Date(row.started_at).toISOString() : undefined,
        endedAt: row.ended_at ? new Date(row.ended_at).toISOString() : undefined,
      })),
    facts: runRow.facts ? (JSON.parse(runRow.facts) as HostFacts) : undefined,
    createdAt: new Date(runRow.created_at).toISOString(),
    updatedAt: new Date(runRow.updated_at).toISOString(),
    summary: runRow.summary ?? undefined,
    lastError: runRow.last_error ?? undefined,
  };

  runCache.set(runId, run);
  return run;
}

export const agentOrchestrator = {
  async startRun(input: StartAgentRunInput, sender: WebContents): Promise<AgentRun> {
    const run: AgentRun = {
      id: crypto.randomUUID(),
      sessionId: input.sessionId,
      workspaceId: input.workspaceId,
      hostId: input.hostId,
      hostLabel: input.hostLabel,
      task: input.task,
      status: 'planning',
      steps: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    runCache.set(run.id, run);
    persistRun(run);
    appendEvent(run.id, 'info', 'Run started');
    emitRun(sender, run);

    try {
      const facts = await agentFactsService.getOrDiscover(input.sessionId, input.hostId);
      run.facts = facts;
      run.updatedAt = nowIso();
      persistRun(run);
      emitRun(sender, run);

      const plannerText = await aiProxy.completeText(input.provider, input.apiKey, input.model, [
        { role: 'system', content: buildPlannerSystemPrompt(facts) },
        { role: 'user', content: input.task },
      ]);

      const parsed = jsonSafeParse<{ steps?: PlannedStep[] }>(extractJsonObject(plannerText));
      const plannedSteps = parsed?.steps?.length ? parsed.steps : fallbackPlan(input.task, facts);

      run.steps = sanitizePlannedSteps(plannedSteps, facts);
      run.steps[0].status = 'awaiting_approval';
      run.status = 'awaiting_approval';
      run.updatedAt = nowIso();

      appendEvent(run.id, 'info', 'Plan generated', undefined, {
        steps: run.steps.map((s) => ({ title: s.title, risk: s.risk })),
      });

      persistRun(run);
      emitRun(sender, run);
      return run;
    } catch (error) {
      run.status = 'failed';
      run.lastError = (error as Error).message;
      run.updatedAt = nowIso();
      appendEvent(run.id, 'error', 'Planning failed', undefined, {
        error: run.lastError,
      });
      persistRun(run);
      if (!sender.isDestroyed()) {
        sender.send('agent:error', run.id, run.lastError);
      }
      emitRun(sender, run);
      return run;
    }
  },

  async approveStep(input: ApproveAgentStepInput, sender: WebContents): Promise<AgentRun> {
    const run = ensureRun(input.runId);
    const step = run.steps.find((candidate) => candidate.id === input.stepId);

    if (!step) {
      throw new Error(`Step not found: ${input.stepId}`);
    }

    if (step.status !== 'awaiting_approval' && step.status !== 'blocked') {
      throw new Error('Step is not awaiting approval');
    }

    if (step.risk === 'destructive' && !input.doubleConfirm) {
      step.status = 'blocked';
      run.status = 'blocked';
      run.lastError = 'Destructive command requires a second confirmation.';
      run.updatedAt = nowIso();
      appendEvent(run.id, 'warning', run.lastError, step.id);
      persistRun(run);
      if (!sender.isDestroyed()) {
        sender.send('agent:blocked', run.id, run.lastError);
      }
      emitRun(sender, run);
      return run;
    }

    if (step.risk === 'needs_privilege' && !run.facts?.isRoot && !input.elevate) {
      step.status = 'blocked';
      run.status = 'blocked';
      run.lastError = 'Step needs elevated privileges. Approve with elevation enabled.';
      run.updatedAt = nowIso();
      appendEvent(run.id, 'warning', run.lastError, step.id);
      persistRun(run);
      if (!sender.isDestroyed()) {
        sender.send('agent:blocked', run.id, run.lastError);
      }
      emitRun(sender, run);
      return run;
    }

    step.status = 'running';
    step.startedAt = nowIso();
    run.status = 'running';
    run.lastError = undefined;
    run.updatedAt = nowIso();
    appendEvent(run.id, 'execution', `Executing: ${step.title}`, step.id);
    persistRun(run);
    emitRun(sender, run);

    try {
      const command = applyElevation(step.command, Boolean(input.elevate), run.facts);
      const execResult = await executeShellCommand(run.sessionId, command, {
        timeoutMs: 5 * 60 * 1000,
        onOutput: (chunk) => emitStepOutput(sender, run.id, step.id, chunk),
      });

      let verifyExitCode = 0;
      let verifyOutput = '';
      if (step.verifyCommand) {
        const verifyResult = await executeShellCommand(
          run.sessionId,
          applyElevation(step.verifyCommand, Boolean(input.elevate), run.facts),
          {
            timeoutMs: 90_000,
            onOutput: (chunk) => emitStepOutput(sender, run.id, step.id, chunk),
          }
        );
        verifyExitCode = verifyResult.exitCode;
        verifyOutput = verifyResult.output;
      }

      const combinedOutput = [execResult.output, verifyOutput].filter(Boolean).join('\n');

      step.exitCode = verifyExitCode !== 0 ? verifyExitCode : execResult.exitCode;
      step.outputSummary = toSummary(combinedOutput);
      step.endedAt = nowIso();

      if (execResult.exitCode === 0 && verifyExitCode === 0) {
        step.status = 'done';
      } else {
        step.status = 'failed';
        step.error = verifyExitCode !== 0
          ? `Verification failed with exit code ${verifyExitCode}`
          : `Command failed with exit code ${execResult.exitCode}`;
      }

      if (step.status === 'failed') {
        run.status = 'failed';
        run.lastError = step.error;
        run.summary = `Run failed at step ${step.index + 1}: ${step.title}`;
      } else {
        const nextStep = run.steps.find((candidate) => candidate.status === 'pending');
        if (nextStep) {
          nextStep.status = 'awaiting_approval';
          run.status = 'awaiting_approval';
          run.summary = `Awaiting approval for step ${nextStep.index + 1}: ${nextStep.title}`;
        } else {
          run.status = 'completed';
          run.summary = 'Run completed successfully.';
        }
      }

      run.updatedAt = nowIso();
      appendEvent(
        run.id,
        step.status === 'done' ? 'verification' : 'error',
        step.status === 'done' ? `Step succeeded: ${step.title}` : `Step failed: ${step.title}`,
        step.id,
        { exitCode: step.exitCode }
      );
      persistRun(run);
      if (run.status === 'completed' && !sender.isDestroyed()) {
        sender.send('agent:done', run.id);
      }
      emitRun(sender, run);
      return run;
    } catch (error) {
      step.status = 'failed';
      step.error = (error as Error).message;
      step.endedAt = nowIso();

      run.status = 'failed';
      run.lastError = step.error;
      run.summary = `Run failed at step ${step.index + 1}: ${step.title}`;
      run.updatedAt = nowIso();

      appendEvent(run.id, 'error', step.error, step.id);
      persistRun(run);
      if (!sender.isDestroyed()) {
        sender.send('agent:error', run.id, step.error);
      }
      emitRun(sender, run);
      return run;
    }
  },

  rejectStep(runId: string, stepId: string, reason: string | undefined, sender: WebContents): AgentRun {
    const run = ensureRun(runId);
    const step = run.steps.find((candidate) => candidate.id === stepId);

    if (!step) {
      throw new Error(`Step not found: ${stepId}`);
    }

    step.status = 'skipped';
    step.endedAt = nowIso();

    run.status = 'cancelled';
    run.summary = `Run cancelled at step ${step.index + 1}`;
    run.lastError = reason || 'Step rejected by user';
    run.updatedAt = nowIso();

    appendEvent(run.id, 'approval', 'Step rejected', step.id, { reason });
    persistRun(run);
    emitRun(sender, run);
    return run;
  },

  cancelRun(runId: string, sender: WebContents): AgentRun {
    const run = ensureRun(runId);
    run.status = 'cancelled';
    run.summary = 'Run cancelled by user.';
    run.updatedAt = nowIso();
    appendEvent(run.id, 'approval', 'Run cancelled by user');
    persistRun(run);
    emitRun(sender, run);
    return run;
  },

  getRun(runId: string): AgentRun {
    return ensureRun(runId);
  },

  listRuns(sessionId?: string): AgentRun[] {
    const rows = sessionId
      ? agentRunQueries.listBySession(sessionId)
      : agentRunQueries.listRecent(50);

    return rows.map((row) => ensureRun(row.id));
  },

  savePlaybook(input: SavePlaybookInput): AgentPlaybook {
    const run = ensureRun(input.runId);
    const playbook: AgentPlaybook = {
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      name: input.name,
      task: run.task,
      sourceRunId: run.id,
      steps: run.steps.map((step) => ({
        title: step.title,
        command: step.command,
        verifyCommand: step.verifyCommand,
      })),
      createdAt: nowIso(),
    };

    agentPlaybookQueries.upsert({
      id: playbook.id,
      workspace_id: playbook.workspaceId ?? null,
      name: playbook.name,
      task: playbook.task,
      source_run_id: playbook.sourceRunId ?? null,
      steps: JSON.stringify(playbook.steps),
      created_at: new Date(playbook.createdAt).getTime(),
    });

    return playbook;
  },

  listPlaybooks(workspaceId?: string): AgentPlaybook[] {
    const rows = workspaceId
      ? agentPlaybookQueries.listByWorkspace(workspaceId)
      : agentPlaybookQueries.listRecent(50);

    return rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id ?? undefined,
      name: row.name,
      task: row.task,
      sourceRunId: row.source_run_id ?? undefined,
      steps: JSON.parse(row.steps) as AgentPlaybook['steps'],
      createdAt: new Date(row.created_at).toISOString(),
    }));
  },
};
