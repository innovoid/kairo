import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Play,
  Save,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  SkipForward,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAgentStore } from '@/stores/agent-store';
import { useSessionStore } from '@/stores/session-store';
import { cn } from '@/lib/utils';
import { formatShortcut } from '@/lib/shortcut-format';
import type { AgentMessage, AgentRun, AgentStep } from '@shared/types/agent';

interface AgentPanelProps {
  onClose: () => void;
  workspaceId?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function RiskBadge({ risk }: { risk: AgentStep['risk'] }) {
  if (risk === 'safe')
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
        <ShieldCheck className="h-2.5 w-2.5" />safe
      </span>
    );
  if (risk === 'needs_privilege')
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
        <ShieldAlert className="h-2.5 w-2.5" />sudo
      </span>
    );
  if (risk === 'destructive')
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-mono">
        <ShieldX className="h-2.5 w-2.5" />destructive
      </span>
    );
  return null;
}

function StepStatusIcon({ status }: { status: AgentStep['status'] }) {
  if (status === 'done') return <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />;
  if (status === 'failed') return <XCircle className="h-3 w-3 text-red-400 shrink-0" />;
  if (status === 'blocked') return <AlertCircle className="h-3 w-3 text-amber-400 shrink-0" />;
  if (status === 'running') return <Loader2 className="h-3 w-3 text-emerald-400 animate-spin shrink-0" />;
  if (status === 'awaiting_approval') return <Clock className="h-3 w-3 text-amber-400 shrink-0" />;
  if (status === 'skipped') return <div className="h-3 w-3 rounded-full bg-zinc-700 shrink-0" />;
  return <div className="h-3 w-3 rounded-full border border-zinc-700 shrink-0" />;
}

// ── Inline step card (shown inside assistant message) ─────────────────────────

interface StepCardProps {
  step: AgentStep;
  stepOutput: string;
  confirmStepId: string | null;
  loading: boolean;
  isActiveStep: boolean;
  onApprove: (step: AgentStep) => void;
  onSkip: (step: AgentStep) => void;
}

function StepCard({ step, stepOutput, confirmStepId, loading, isActiveStep, onApprove, onSkip }: StepCardProps) {
  const [expanded, setExpanded] = useState(
    step.status === 'awaiting_approval' || step.status === 'running' || step.status === 'failed'
  );
  const isAwaiting = step.status === 'awaiting_approval' || step.status === 'blocked';
  const isConfirm = step.requiresDoubleConfirm && confirmStepId === step.id;
  const outputText = stepOutput || step.outputSummary || '';

  useEffect(() => {
    if (step.status === 'running' || step.status === 'awaiting_approval' || step.status === 'failed') {
      setExpanded(true);
    }
  }, [step.status]);

  const borderColor =
    step.status === 'done' ? 'border-emerald-500/20' :
    step.status === 'failed' ? 'border-red-500/25' :
    step.status === 'running' ? 'border-emerald-500/40' :
    step.status === 'awaiting_approval' || step.status === 'blocked' ? 'border-amber-500/30' :
    'border-zinc-800/60';

  const bgColor =
    step.status === 'running' ? 'bg-emerald-500/[0.03]' :
    step.status === 'awaiting_approval' ? 'bg-amber-500/[0.03]' :
    'bg-transparent';

  return (
    <div className={cn('rounded-md border overflow-hidden transition-all duration-200', borderColor, bgColor)}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <StepStatusIcon status={step.status} />
        <span className="text-[10px] font-medium text-zinc-300 flex-1 min-w-0 truncate">{step.title}</span>
        <RiskBadge risk={step.risk} />
        <span className="text-zinc-700 shrink-0 ml-1">
          {expanded ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
        </span>
      </button>

      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-1.5 border-t border-zinc-800/50">
          {step.explain && (
            <p className="text-[10px] text-zinc-500 pt-1.5 leading-relaxed">{step.explain}</p>
          )}
          <code className="block text-[10px] font-mono text-emerald-300/90 bg-black/50 rounded px-2 py-1.5 break-all border border-zinc-800/60">
            {step.command}
          </code>
          {step.verifyCommand && (
            <div className="flex items-center gap-1">
              <Check className="h-2 w-2 text-zinc-600 shrink-0" />
              <code className="text-[10px] font-mono text-zinc-600 break-all">{step.verifyCommand}</code>
            </div>
          )}
          {outputText && (
            <div className="rounded bg-black/60 border border-zinc-800/50 max-h-28 overflow-y-auto">
              <pre className="text-[10px] font-mono text-zinc-400 px-2 py-1.5 leading-relaxed whitespace-pre-wrap break-all">
                {outputText}
              </pre>
            </div>
          )}
          {step.error && (
            <p className="text-[10px] text-red-400 font-mono bg-red-500/5 border border-red-500/15 rounded px-2 py-1">
              {step.error}
            </p>
          )}
          {isAwaiting && isActiveStep && (
            <div className="flex items-center gap-1.5 pt-0.5">
              {isConfirm && (
                <p className="text-[10px] text-red-400 flex-1 font-medium">Confirm destructive action?</p>
              )}
              <div className={cn('flex gap-1.5', isConfirm ? '' : 'ml-auto')}>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={loading}
                  onClick={() => onSkip(step)}
                  className="h-5 px-1.5 text-[10px] gap-0.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 border border-zinc-800"
                >
                  <SkipForward className="h-2 w-2" />
                  Skip
                </Button>
                <Button
                  size="sm"
                  disabled={loading}
                  onClick={() => onApprove(step)}
                  className={cn(
                    'h-5 px-2 text-[10px] gap-0.5 border-0',
                    isConfirm
                      ? 'bg-red-600 hover:bg-red-500 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white',
                  )}
                >
                  {loading ? (
                    <Loader2 className="h-2 w-2 animate-spin" />
                  ) : isConfirm ? (
                    <ShieldAlert className="h-2 w-2" />
                  ) : (
                    <Check className="h-2 w-2" />
                  )}
                  {isConfirm ? 'Confirm' : 'Run'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  msg: AgentMessage;
  run: AgentRun;
  stepOutputByStepId: Record<string, string>;
  confirmStepId: string | null;
  loading: boolean;
  onApprove: (step: AgentStep) => void;
  onSkip: (step: AgentStep) => void;
}

function MessageBubble({ msg, run, stepOutputByStepId, confirmStepId, loading, onApprove, onSkip }: MessageBubbleProps) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl rounded-tr-sm bg-emerald-600/20 border border-emerald-500/20 px-3 py-2">
          <p className="text-[11px] text-zinc-200 leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        </div>
      </div>
    );
  }

  // Error message — red card
  if (msg.error) {
    return (
      <div className="flex items-start gap-2">
        <div className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertCircle className="h-2.5 w-2.5 text-red-400" />
        </div>
        <div className="flex-1 min-w-0 rounded-lg border border-red-500/20 bg-red-500/[0.04] px-3 py-2">
          <p className="text-[10px] font-semibold text-red-400 mb-0.5">AI Error</p>
          <p className="text-[11px] text-red-300/80 leading-relaxed font-mono whitespace-pre-wrap break-all">{msg.error}</p>
        </div>
      </div>
    );
  }

  // Assistant message
  // Find the current "active" awaiting_approval step for this run, if any
  const activeStep = run.steps.find(
    (s) => s.status === 'awaiting_approval' || s.status === 'blocked' || s.status === 'running'
  );

  return (
    <div className="flex flex-col gap-2">
      {/* AI text content */}
      {(msg.content || msg.streaming) && (
        <div className="flex items-start gap-2">
          <div className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Bot className="h-2.5 w-2.5 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {msg.content}
              {msg.streaming && (
                <span className="inline-flex gap-0.5 ml-1 align-middle">
                  <span className="h-1 w-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="h-1 w-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="h-1 w-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:300ms]" />
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Inline plan / step cards */}
      {msg.plan && msg.plan.length > 0 && (
        <div className="ml-7 space-y-1">
          {msg.plan.map((step) => {
            // Find the live step in run.steps (has updated status)
            const liveStep = run.steps.find((s) => s.id === step.id) ?? step;
            const isActive = liveStep.id === activeStep?.id;
            return (
              <StepCard
                key={liveStep.id}
                step={liveStep}
                stepOutput={stepOutputByStepId[liveStep.id] ?? ''}
                confirmStepId={confirmStepId}
                loading={loading}
                isActiveStep={isActive}
                onApprove={onApprove}
                onSkip={onSkip}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

const EXAMPLE_PROMPTS = [
  'Check why my Docker + Traefik app is not working',
  'Install and configure nginx as a reverse proxy',
  'Diagnose high CPU usage',
  'Check disk space and clean up old logs',
  'Set up fail2ban for SSH protection',
];

// ── Main panel ─────────────────────────────────────────────────────────────────

export function AgentPanel({ onClose, workspaceId }: AgentPanelProps) {
  const [input, setInput] = useState('');
  const [playbookName, setPlaybookName] = useState('');
  const [confirmStepId, setConfirmStepId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playbooksOpen, setPlaybooksOpen] = useState(false);
  const [playbooks, setPlaybooks] = useState<Array<{ id: string; name: string; task: string }>>([]);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const initListeners = useAgentStore((s) => s.initListeners);
  const startRun = useAgentStore((s) => s.startRun);
  const approveStep = useAgentStore((s) => s.approveStep);
  const rejectStep = useAgentStore((s) => s.rejectStep);
  const cancelRun = useAgentStore((s) => s.cancelRun);
  const chat = useAgentStore((s) => s.chat);
  const savePlaybook = useAgentStore((s) => s.savePlaybook);
  const listPlaybooks = useAgentStore((s) => s.listPlaybooks);
  const runPlaybook = useAgentStore((s) => s.runPlaybook);
  const activeRunBySession = useAgentStore((s) => s.activeRunBySession);
  const runs = useAgentStore((s) => s.runs);
  const stepOutputByStepId = useAgentStore((s) => s.stepOutputByStepId);

  const tabs = useSessionStore((s) => s.tabs);
  const activeTabId = useSessionStore((s) => s.activeTabId);

  const activeTerminalTab = useMemo(() => {
    const tab = activeTabId ? tabs.get(activeTabId) : null;
    if (!tab || tab.tabType !== 'terminal' || !tab.sessionId) return null;
    return tab;
  }, [tabs, activeTabId]);

  const activeRun = useMemo(() => {
    const sid = activeTerminalTab?.sessionId;
    if (!sid) return null;
    const runId = activeRunBySession[sid];
    return runId ? runs[runId] ?? null : null;
  }, [activeTerminalTab?.sessionId, activeRunBySession, runs]);

  const isPlanning = activeRun?.status === 'planning';
  const isStreaming = activeRun?.messages.some((m) => m.streaming) ?? false;
  const canSend = !loading && !isPlanning && !isStreaming && !!input.trim();
  const sendShortcut = formatShortcut('mod+enter');

  useEffect(() => { initListeners(); }, [initListeners]);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeRun?.messages.length, activeRun?.status, isStreaming]);

  async function handleSend() {
    const text = input.trim();
    if (!text || !activeTerminalTab) return;
    setInput('');

    try {
      setLoading(true);
      if (!activeRun) {
        // Start a new run
        await startRun({
          sessionId: activeTerminalTab.sessionId!,
          task: text,
          workspaceId,
          hostId: activeTerminalTab.hostId,
          hostLabel: activeTerminalTab.label,
        });
      } else {
        // Follow-up message in existing run
        await chat(activeRun.id, text);
      }
    } catch (err) {
      toast.error((err as Error).message || 'Failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(step: AgentStep) {
    if (!activeRun) return;
    if (step.requiresDoubleConfirm && confirmStepId !== step.id) {
      setConfirmStepId(step.id);
      return;
    }
    try {
      setLoading(true);
      await approveStep(activeRun.id, step, { elevate: step.risk === 'needs_privilege', doubleConfirm: step.requiresDoubleConfirm });
      setConfirmStepId(null);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to run step');
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip(step: AgentStep) {
    if (!activeRun) return;
    try {
      setLoading(true);
      await rejectStep(activeRun.id, step.id, 'Skipped by user');
      setConfirmStepId(null);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to skip step');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!activeRun) return;
    try {
      setLoading(true);
      await cancelRun(activeRun.id);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to cancel');
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePlaybook() {
    if (!activeRun || !playbookName.trim()) return;
    try {
      setLoading(true);
      await savePlaybook(activeRun.id, playbookName.trim(), workspaceId);
      setPlaybookName('');
      toast.success('Playbook saved');
    } catch (err) {
      toast.error((err as Error).message || 'Failed to save playbook');
    } finally {
      setLoading(false);
    }
  }

  async function handleRunPlaybook(pb: { id: string; name: string }) {
    if (!activeTerminalTab) return;
    try {
      setLoading(true);
      setPlaybooksOpen(false);
      await runPlaybook({
        playbookId: pb.id,
        sessionId: activeTerminalTab.sessionId!,
        workspaceId,
        hostId: activeTerminalTab.hostId,
        hostLabel: activeTerminalTab.label,
      });
      toast.success(`Playbook loaded: ${pb.name}`);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to run playbook');
    } finally {
      setLoading(false);
    }
  }

  async function loadPlaybooks() {
    try {
      const rows = await listPlaybooks(workspaceId);
      setPlaybooks(rows.map((r) => ({ id: r.id, name: r.name, task: r.task })));
    } catch {}
  }

  const runIsDone = activeRun?.status === 'completed' || activeRun?.status === 'failed' || activeRun?.status === 'cancelled';

  // Status indicator for header
  const statusDot =
    !activeRun ? null :
    activeRun.status === 'planning' || isStreaming ? 'text-emerald-400 animate-pulse' :
    activeRun.status === 'running' ? 'text-emerald-400' :
    activeRun.status === 'awaiting_approval' || activeRun.status === 'blocked' ? 'text-amber-400' :
    activeRun.status === 'completed' ? 'text-emerald-400' :
    activeRun.status === 'failed' ? 'text-red-400' :
    'text-zinc-600';

  const canCancel = activeRun && (
    activeRun.status === 'awaiting_approval' || activeRun.status === 'running' ||
    activeRun.status === 'blocked' || activeRun.status === 'planning'
  );

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 border-l border-zinc-800/70">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/70 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Bot className="h-3 w-3 text-emerald-400" />
          </div>
          <span className="text-xs font-semibold text-zinc-200 tracking-tight">AI Agent</span>
          {activeTerminalTab && (
            <span className="text-[10px] text-zinc-600 font-mono truncate max-w-[70px]">
              {activeTerminalTab.label}
            </span>
          )}
          {statusDot && (
            <span className={cn('h-1.5 w-1.5 rounded-full bg-current shrink-0', statusDot)} />
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Playbooks */}
          <button
            type="button"
            onClick={() => { setPlaybooksOpen((v) => !v); if (!playbooksOpen) void loadPlaybooks(); }}
            className="h-5 w-5 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            title="Playbooks"
          >
            <BookOpen className="h-3 w-3" />
          </button>
          {/* Cancel run */}
          {canCancel && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="h-5 w-5 flex items-center justify-center rounded text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-40"
              title="Cancel run"
            >
              <XCircle className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-5 w-5 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Playbooks dropdown */}
      {playbooksOpen && (
        <div className="shrink-0 border-b border-zinc-800/70 bg-zinc-900/60">
          <div className="px-3 py-2 max-h-40 overflow-y-auto space-y-1">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium mb-1.5">Saved playbooks</p>
            {playbooks.length === 0 ? (
              <p className="text-[10px] text-zinc-600 py-2">No playbooks saved yet.</p>
            ) : (
              playbooks.map((pb) => (
                <button
                  key={pb.id}
                  type="button"
                  onClick={() => void handleRunPlaybook(pb)}
                  disabled={loading || !activeTerminalTab}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 transition-colors text-left disabled:opacity-40"
                >
                  <Play className="h-2.5 w-2.5 text-emerald-500/50 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-zinc-300 truncate font-medium">{pb.name}</p>
                    <p className="text-[10px] text-zinc-600 truncate font-mono">{pb.task}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Conversation thread */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 py-3 space-y-4">
          {/* Empty state */}
          {!activeRun && !isPlanning && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-emerald-500/60" />
              </div>
              <div>
                <p className="text-[11px] font-medium text-zinc-400">Ask me anything about this server</p>
                <p className="text-[10px] text-zinc-600 mt-0.5 leading-relaxed max-w-[200px]">
                  I'll plan the steps, run them one by one with your approval, and analyse the output.
                </p>
              </div>
              <div className="space-y-1 w-full">
                {EXAMPLE_PROMPTS.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => { setInput(ex); inputRef.current?.focus(); }}
                    className="w-full text-left px-2.5 py-1.5 text-[10px] text-zinc-500 hover:text-zinc-300 border border-zinc-800/60 hover:border-zinc-700 rounded-md transition-colors font-mono leading-relaxed"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Planning shimmer */}
          {isPlanning && (
            <div className="space-y-2 py-2">
              <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                <Loader2 className="h-3 w-3 animate-spin text-emerald-500" />
                Discovering host environment and planning…
              </div>
              {[70, 55, 65].map((w, i) => (
                <div
                  key={i}
                  className="h-8 rounded bg-zinc-900 animate-pulse border border-zinc-800"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          )}

          {/* Conversation messages */}
          {activeRun && activeRun.messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              run={activeRun}
              stepOutputByStepId={stepOutputByStepId}
              confirmStepId={confirmStepId}
              loading={loading}
              onApprove={handleApprove}
              onSkip={handleSkip}
            />
          ))}

          {/* Post-run actions */}
          {activeRun && runIsDone && (
            <div className="space-y-2 pt-1 border-t border-zinc-800/50">
              {activeRun.status === 'completed' && (
                <div className="flex items-center gap-1.5">
                  <input
                    value={playbookName}
                    onChange={(e) => setPlaybookName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleSavePlaybook(); }}
                    placeholder="Save as playbook…"
                    className="flex-1 h-6 px-2 text-[10px] font-mono rounded bg-black/40 border border-zinc-800 text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/40"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleSavePlaybook()}
                    disabled={loading || !playbookName.trim()}
                    className="h-6 px-2 text-[10px] border-zinc-700 hover:bg-zinc-800 gap-1"
                  >
                    <Save className="h-2.5 w-2.5" />
                  </Button>
                </div>
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input bar */}
      <div className="px-3 py-2.5 border-t border-zinc-800/70 space-y-1.5 shrink-0">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (canSend) void handleSend();
              }
            }}
            placeholder={
              !activeTerminalTab
                ? 'Open a terminal tab first…'
                : !activeRun
                  ? `Describe a task… (${sendShortcut} to send)`
                  : 'Ask a follow-up or give new instructions…'
            }
            disabled={loading || isPlanning || isStreaming || !activeTerminalTab}
            rows={2}
            className={cn(
              'w-full resize-none rounded-lg px-2.5 py-2 pr-8 text-[11px] font-mono',
              'bg-black/40 border border-zinc-800 text-zinc-200',
              'placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/40',
              'transition-colors disabled:opacity-40',
            )}
          />
          <button
            type="button"
            onClick={() => { if (canSend) void handleSend(); }}
            disabled={!canSend}
            className={cn(
              'absolute right-2 bottom-2 h-5 w-5 flex items-center justify-center rounded transition-colors',
              canSend ? 'text-emerald-400 hover:text-emerald-300' : 'text-zinc-700',
            )}
          >
            <Send className="h-3 w-3" />
          </button>
        </div>
        {isStreaming && (
          <p className="text-[10px] text-zinc-600 font-mono">AI is analysing…</p>
        )}
      </div>
    </div>
  );
}
