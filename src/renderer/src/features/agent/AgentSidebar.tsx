import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot, Check, ChevronRight, Play, RotateCcw, Save, ShieldAlert,
  Sparkles, X, BookOpen, Zap, AlertCircle, CheckCircle2, Loader2, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAgentStore } from '@/stores/agent-store';
import { useSessionStore } from '@/stores/session-store';
import { cn } from '@/lib/utils';
import type { AgentStep } from '@shared/types/agent';

interface AgentSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId?: string;
}

// ── Step status helpers ────────────────────────────────────────────────────────

function StepIcon({ status }: { status: AgentStep['status'] | string }) {
  if (status === 'done' || status === 'completed')
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
  if (status === 'failed' || status === 'blocked')
    return <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />;
  if (status === 'running')
    return <Loader2 className="h-3.5 w-3.5 text-emerald-400 animate-spin shrink-0" />;
  if (status === 'awaiting_approval')
    return <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
  return <div className="h-3.5 w-3.5 rounded-full border border-zinc-700 shrink-0" />;
}

function stepBg(status: AgentStep['status'] | string): string {
  if (status === 'done' || status === 'completed') return 'border-emerald-500/20 bg-emerald-500/5';
  if (status === 'failed' || status === 'blocked') return 'border-red-500/20 bg-red-500/5';
  if (status === 'running') return 'border-emerald-500/30 bg-emerald-500/8';
  if (status === 'awaiting_approval') return 'border-amber-500/25 bg-amber-500/5';
  return 'border-zinc-800 bg-zinc-900/40';
}

function riskBadge(risk: string): string {
  if (risk === 'safe') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (risk === 'moderate') return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  return 'text-red-400 bg-red-500/10 border-red-500/20';
}

function runStatusBadge(status: string): string {
  if (status === 'completed') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (status === 'failed' || status === 'cancelled') return 'text-red-400 bg-red-500/10 border-red-500/20';
  if (status === 'running') return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20';
  return 'text-zinc-400 bg-zinc-800 border-zinc-700';
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function AgentSidebar({ open, onOpenChange, workspaceId }: AgentSidebarProps) {
  const [task, setTask] = useState('');
  const [playbookName, setPlaybookName] = useState('');
  const [confirmStepId, setConfirmStepId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playbooksLoading, setPlaybooksLoading] = useState(false);
  const [view, setView] = useState<'run' | 'playbooks'>('run');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const initListeners = useAgentStore((s) => s.initListeners);
  const startRun = useAgentStore((s) => s.startRun);
  const approveStep = useAgentStore((s) => s.approveStep);
  const cancelRun = useAgentStore((s) => s.cancelRun);
  const savePlaybook = useAgentStore((s) => s.savePlaybook);
  const listPlaybooks = useAgentStore((s) => s.listPlaybooks);
  const runPlaybook = useAgentStore((s) => s.runPlaybook);
  const activeRunBySession = useAgentStore((s) => s.activeRunBySession);
  const runs = useAgentStore((s) => s.runs);

  const tabs = useSessionStore((s) => s.tabs);
  const activeTabId = useSessionStore((s) => s.activeTabId);

  const activeTerminalTab = useMemo(() => {
    const tab = activeTabId ? tabs.get(activeTabId) : null;
    if (!tab || tab.tabType !== 'terminal' || !tab.sessionId) return null;
    return tab;
  }, [tabs, activeTabId]);

  const activeRun = useMemo(() => {
    const sessionId = activeTerminalTab?.sessionId;
    if (!sessionId) return null;
    const runId = activeRunBySession[sessionId];
    return runId ? runs[runId] ?? null : null;
  }, [activeTerminalTab?.sessionId, activeRunBySession, runs]);

  const [playbooks, setPlaybooks] = useState<Array<{ id: string; name: string; task: string }>>([]);

  useEffect(() => { initListeners(); }, [initListeners]);

  useEffect(() => {
    if (!open) return;
    setConfirmStepId(null);
    if (view === 'playbooks') void refreshPlaybooks();
  }, [open, workspaceId, view]);

  // Auto-focus input when sidebar opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  async function refreshPlaybooks() {
    try {
      setPlaybooksLoading(true);
      const rows = await listPlaybooks(workspaceId);
      setPlaybooks(rows.map((r) => ({ id: r.id, name: r.name, task: r.task })));
    } catch (err) {
      toast.error((err as Error).message || 'Failed to load playbooks');
    } finally {
      setPlaybooksLoading(false);
    }
  }

  async function handleStartRun() {
    if (!activeTerminalTab) { toast.error('Open a terminal tab first'); return; }
    const prompt = task.trim();
    if (!prompt) { toast.error('Describe what you want to do'); return; }
    try {
      setLoading(true);
      await startRun({ sessionId: activeTerminalTab.sessionId!, task: prompt, workspaceId, hostId: activeTerminalTab.hostId, hostLabel: activeTerminalTab.label });
      setTask('');
      toast.success('Agent plan generated');
    } catch (err) {
      toast.error((err as Error).message || 'Failed to start agent run');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(step: AgentStep) {
    if (!activeRun) return;
    if (step.requiresDoubleConfirm && confirmStepId !== step.id) {
      setConfirmStepId(step.id);
      toast.warning('Press approve again to confirm this destructive step');
      return;
    }
    try {
      setLoading(true);
      await approveStep(activeRun.id, step, { elevate: step.risk === 'needs_privilege', doubleConfirm: step.requiresDoubleConfirm });
      setConfirmStepId(null);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to approve step');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelRun() {
    if (!activeRun) return;
    try {
      setLoading(true);
      await cancelRun(activeRun.id);
      setConfirmStepId(null);
    } catch (err) {
      toast.error((err as Error).message || 'Failed to cancel run');
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePlaybook() {
    if (!activeRun) { toast.error('No active run to save'); return; }
    const name = playbookName.trim();
    if (!name) { toast.error('Enter a playbook name'); return; }
    try {
      setLoading(true);
      await savePlaybook(activeRun.id, name, workspaceId);
      setPlaybookName('');
      await refreshPlaybooks();
      toast.success('Playbook saved');
    } catch (err) {
      toast.error((err as Error).message || 'Failed to save playbook');
    } finally {
      setLoading(false);
    }
  }

  async function handleRunPlaybook(playbook: { id: string; name: string }) {
    if (!activeTerminalTab) { toast.error('Open a terminal tab first'); return; }
    try {
      setLoading(true);
      await runPlaybook({ playbookId: playbook.id, sessionId: activeTerminalTab.sessionId!, workspaceId, hostId: activeTerminalTab.hostId, hostLabel: activeTerminalTab.label });
      toast.success(`Playbook loaded: ${playbook.name}`);
      setView('run');
    } catch (err) {
      toast.error((err as Error).message || 'Failed to run playbook');
    } finally {
      setLoading(false);
    }
  }

  const pendingSteps = activeRun?.steps.filter(
    (s) => s.status === 'awaiting_approval' || s.status === 'blocked'
  ) ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[400px] max-w-[95vw] p-0 flex flex-col bg-zinc-950 border-l border-zinc-800/60 gap-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Bot className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-100">AI Agent</p>
              <p className="text-[10px] text-zinc-500 font-mono leading-none mt-0.5">
                {activeTerminalTab ? activeTerminalTab.label : 'No terminal selected'}
              </p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="h-6 w-6 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* View Tabs */}
        <div className="flex shrink-0 border-b border-zinc-800/60">
          {(['run', 'playbooks'] as const).map((v) => (
            <button
              key={v}
              onClick={() => { setView(v); if (v === 'playbooks') void refreshPlaybooks(); }}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors',
                view === v
                  ? 'text-emerald-400 border-b-2 border-emerald-500'
                  : 'text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent',
              )}
            >
              {v === 'run' ? <Zap className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
              {v === 'run' ? 'Run' : 'Playbooks'}
            </button>
          ))}
        </div>

        {view === 'run' ? (
          <>
            {/* Prompt input */}
            <div className="px-4 pt-3 pb-3 border-b border-zinc-800/60 shrink-0 space-y-2">
              <textarea
                ref={inputRef}
                value={task}
                onChange={(e) => setTask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void handleStartRun();
                  }
                }}
                placeholder={activeTerminalTab
                  ? `What should I do on ${activeTerminalTab.label}?\n\nInstall Docker, check disk usage, set up a service…`
                  : 'Open a terminal tab to use the agent…'}
                disabled={loading || !activeTerminalTab}
                rows={3}
                className={cn(
                  'w-full resize-none rounded-lg px-3 py-2.5 text-sm font-mono',
                  'bg-zinc-900 border border-zinc-700/60 text-zinc-200',
                  'placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50',
                  'transition-colors disabled:opacity-40',
                )}
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-600 font-mono">⌘↵ to run</span>
                <Button
                  onClick={() => void handleStartRun()}
                  disabled={loading || !activeTerminalTab || !task.trim()}
                  size="sm"
                  className="h-7 px-3 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white border-0"
                >
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Plan Run
                </Button>
              </div>
            </div>

            {/* Run output */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-4 py-3 space-y-3">
                {!activeRun ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                    <div className="h-10 w-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-zinc-600" />
                    </div>
                    <p className="text-xs text-zinc-500 max-w-[200px] leading-relaxed">
                      Describe a task and the agent will plan and execute it on the active terminal.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Run header */}
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-zinc-200 leading-snug">{activeRun.task}</p>
                      </div>
                      <span className={cn('shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-mono', runStatusBadge(activeRun.status))}>
                        {activeRun.status}
                      </span>
                    </div>

                    {/* Steps */}
                    <div className="space-y-2">
                      {activeRun.steps.map((step, i) => {
                        const awaiting = step.status === 'awaiting_approval' || step.status === 'blocked';
                        const isConfirm = step.requiresDoubleConfirm && confirmStepId === step.id;

                        return (
                          <div
                            key={step.id}
                            className={cn('rounded-lg border p-3 space-y-2 transition-colors', stepBg(step.status))}
                          >
                            {/* Step header */}
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-zinc-600 shrink-0">
                                {String(i + 1).padStart(2, '0')}
                              </span>
                              <StepIcon status={step.status} />
                              <p className="text-xs font-medium text-zinc-200 flex-1 min-w-0 truncate">
                                {step.title}
                              </p>
                              <span className={cn('text-[9px] px-1.5 py-0.5 rounded border font-mono shrink-0', riskBadge(step.risk))}>
                                {step.risk}
                              </span>
                            </div>

                            {/* Command */}
                            <code className="block w-full text-[11px] font-mono text-emerald-300 bg-black/40 rounded-md px-2.5 py-2 break-all leading-relaxed">
                              {step.command}
                            </code>

                            {/* Error */}
                            {step.error && (
                              <p className="text-[11px] text-red-400 font-mono leading-snug">{step.error}</p>
                            )}

                            {/* Approve button */}
                            {awaiting && (
                              <div className="flex items-center gap-2 pt-0.5">
                                {isConfirm && (
                                  <p className="text-[10px] text-amber-400 flex-1">
                                    This is destructive — confirm?
                                  </p>
                                )}
                                <Button
                                  size="sm"
                                  disabled={loading}
                                  onClick={() => void handleApprove(step)}
                                  className={cn(
                                    'h-6 px-2.5 text-[11px] gap-1 ml-auto',
                                    isConfirm
                                      ? 'bg-red-600 hover:bg-red-500 text-white border-0'
                                      : 'bg-emerald-600 hover:bg-emerald-500 text-white border-0',
                                  )}
                                >
                                  {isConfirm ? <ShieldAlert className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                                  {isConfirm ? 'Confirm' : 'Approve'}
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      {pendingSteps.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleCancelRun()}
                          disabled={loading}
                          className="flex-1 h-7 text-xs gap-1 text-red-400 border-red-500/20 hover:bg-red-500/10 hover:text-red-300"
                        >
                          <X className="h-3 w-3" />
                          Cancel Run
                        </Button>
                      )}
                      {activeRun.status === 'completed' && (
                        <div className="flex-1 space-y-1.5">
                          <p className="text-[10px] text-zinc-500">Save as playbook</p>
                          <div className="flex gap-1.5">
                            <input
                              value={playbookName}
                              onChange={(e) => setPlaybookName(e.target.value)}
                              placeholder="my-playbook"
                              className="flex-1 h-7 px-2.5 text-xs font-mono rounded-md bg-zinc-900 border border-zinc-700/60 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleSavePlaybook()}
                              disabled={loading || !playbookName.trim()}
                              className="h-7 px-2 text-xs border-zinc-700 hover:bg-zinc-800"
                            >
                              <Save className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          /* Playbooks view */
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-4 py-3 space-y-3">
              <p className="text-[11px] text-zinc-500">
                Saved playbooks let you replay tasks across sessions.
              </p>
              {playbooksLoading ? (
                <div className="flex items-center gap-2 py-4 text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">Loading playbooks…</span>
                </div>
              ) : playbooks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                  <BookOpen className="h-8 w-8 text-zinc-700" />
                  <p className="text-xs text-zinc-500 max-w-[180px] leading-relaxed">
                    Complete a run, then save it as a playbook to reuse it.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {playbooks.map((pb) => (
                    <div
                      key={pb.id}
                      className="flex items-center gap-2.5 p-3 rounded-lg border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition-colors group"
                    >
                      <div className="h-7 w-7 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                        <BookOpen className="h-3.5 w-3.5 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-zinc-200 truncate">{pb.name}</p>
                        <p className="text-[10px] text-zinc-500 truncate mt-0.5 font-mono">{pb.task}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => void handleRunPlaybook(pb)}
                        disabled={loading || !activeTerminalTab}
                        className="h-6 px-2 text-[11px] gap-1 bg-emerald-600/80 hover:bg-emerald-500 text-white border-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Play className="h-3 w-3" />
                        Run
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
