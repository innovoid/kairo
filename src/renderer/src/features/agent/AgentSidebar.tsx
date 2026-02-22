import { useEffect, useMemo, useState } from 'react';
import { Bot, Check, Play, Save, ShieldAlert, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAgentStore } from '@/stores/agent-store';
import { useSessionStore } from '@/stores/session-store';
import type { AgentStep } from '@shared/types/agent';

interface AgentSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId?: string;
}

function statusBadgeClass(status: AgentStep['status'] | string): string {
  if (status === 'done' || status === 'completed') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  if (status === 'failed' || status === 'blocked') return 'bg-red-500/20 text-red-400 border-red-500/30';
  if (status === 'running') return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
  if (status === 'awaiting_approval') return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  return 'bg-muted text-muted-foreground border-border';
}

export function AgentSidebar({ open, onOpenChange, workspaceId }: AgentSidebarProps) {
  const [task, setTask] = useState('');
  const [playbookName, setPlaybookName] = useState('');
  const [confirmStepId, setConfirmStepId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playbooksLoading, setPlaybooksLoading] = useState(false);

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

  useEffect(() => {
    initListeners();
  }, [initListeners]);

  useEffect(() => {
    if (!open) return;
    setConfirmStepId(null);
    void refreshPlaybooks();
  }, [open, workspaceId]);

  async function refreshPlaybooks() {
    try {
      setPlaybooksLoading(true);
      const rows = await listPlaybooks(workspaceId);
      setPlaybooks(rows.map((row) => ({ id: row.id, name: row.name, task: row.task })));
    } catch (error) {
      toast.error((error as Error).message || 'Failed to load playbooks');
    } finally {
      setPlaybooksLoading(false);
    }
  }

  async function handleStartRun() {
    const tab = activeTerminalTab;
    if (!tab) {
      toast.error('Open a terminal tab first');
      return;
    }
    const prompt = task.trim();
    if (!prompt) {
      toast.error('Describe what you want to do');
      return;
    }

    try {
      setLoading(true);
      await startRun({
        sessionId: tab.sessionId!,
        task: prompt,
        workspaceId,
        hostId: tab.hostId,
        hostLabel: tab.label,
      });
      setTask('');
      toast.success('Agent plan generated');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to start agent run');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(step: AgentStep) {
    if (!activeRun) return;

    if (step.requiresDoubleConfirm && confirmStepId !== step.id) {
      setConfirmStepId(step.id);
      toast.warning('Press approve again to confirm destructive step');
      return;
    }

    try {
      setLoading(true);
      await approveStep(activeRun.id, step, {
        elevate: step.risk === 'needs_privilege',
        doubleConfirm: step.requiresDoubleConfirm,
      });
      setConfirmStepId(null);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to approve step');
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
    } catch (error) {
      toast.error((error as Error).message || 'Failed to cancel run');
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePlaybook() {
    if (!activeRun) {
      toast.error('No active run to save');
      return;
    }

    const name = playbookName.trim();
    if (!name) {
      toast.error('Enter a playbook name');
      return;
    }

    try {
      setLoading(true);
      await savePlaybook(activeRun.id, name, workspaceId);
      setPlaybookName('');
      await refreshPlaybooks();
      toast.success('Playbook saved');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to save playbook');
    } finally {
      setLoading(false);
    }
  }

  async function handleRunPlaybook(playbook: { id: string; name: string }) {
    const tab = activeTerminalTab;
    if (!tab) {
      toast.error('Open a terminal tab first');
      return;
    }

    try {
      setLoading(true);
      await runPlaybook({
        playbookId: playbook.id,
        sessionId: tab.sessionId!,
        workspaceId,
        hostId: tab.hostId,
        hostLabel: tab.label,
      });
      toast.success(`Playbook loaded: ${playbook.name}`);
    } catch (error) {
      toast.error((error as Error).message || 'Failed to run playbook');
    } finally {
      setLoading(false);
    }
  }

  const runnableSteps = activeRun?.steps.filter(
    (step) => step.status === 'awaiting_approval' || step.status === 'blocked'
  ) ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[440px] max-w-[95vw] p-0 flex flex-col gap-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Bot className="h-4 w-4 text-primary" />
            AI Agent
          </SheetTitle>
        </SheetHeader>

        <div className="p-4 border-b space-y-3">
          <Input
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Install Docker on this host"
            disabled={loading}
          />
          <Button onClick={handleStartRun} className="w-full" disabled={loading || !activeTerminalTab}>
            <Sparkles className="h-4 w-4 mr-2" />
            Plan Run
          </Button>
          {!activeTerminalTab && (
            <p className="text-xs text-muted-foreground">Open a terminal tab to run the agent.</p>
          )}
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {activeRun ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-medium truncate">{activeRun.task}</h3>
                  <span className={`text-[10px] px-2 py-1 rounded border ${statusBadgeClass(activeRun.status)}`}>
                    {activeRun.status}
                  </span>
                </div>

                {activeRun.steps.map((step) => {
                  const awaiting = step.status === 'awaiting_approval' || step.status === 'blocked';
                  const destructiveConfirm = step.requiresDoubleConfirm && confirmStepId === step.id;
                  return (
                    <div key={step.id} className="border rounded-md p-3 space-y-2 bg-card/40">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{step.title}</p>
                        <span className={`text-[10px] px-2 py-1 rounded border ${statusBadgeClass(step.status)}`}>
                          {step.status}
                        </span>
                      </div>
                      <code className="block text-xs bg-muted p-2 rounded break-all">{step.command}</code>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground capitalize">risk: {step.risk}</span>
                        {awaiting && (
                          <Button size="sm" disabled={loading} onClick={() => void handleApprove(step)}>
                            {destructiveConfirm ? <ShieldAlert className="h-3 w-3 mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                            {destructiveConfirm ? 'Confirm' : 'Approve'}
                          </Button>
                        )}
                      </div>
                      {step.error && <p className="text-xs text-red-400">{step.error}</p>}
                    </div>
                  );
                })}

                {runnableSteps.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => void handleCancelRun()} disabled={loading}>
                    <X className="h-3 w-3 mr-1" />
                    Cancel Run
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active run for this terminal.</p>
            )}

            <div className="pt-4 border-t space-y-3">
              <h4 className="text-sm font-medium">Playbooks</h4>
              <div className="flex gap-2">
                <Input
                  value={playbookName}
                  onChange={(e) => setPlaybookName(e.target.value)}
                  placeholder="docker-setup"
                  disabled={loading}
                />
                <Button variant="outline" onClick={() => void handleSavePlaybook()} disabled={loading || !activeRun}>
                  <Save className="h-4 w-4" />
                </Button>
              </div>

              {playbooksLoading ? (
                <p className="text-xs text-muted-foreground">Loading playbooks...</p>
              ) : playbooks.length === 0 ? (
                <p className="text-xs text-muted-foreground">No saved playbooks yet.</p>
              ) : (
                <div className="space-y-2">
                  {playbooks.slice(0, 8).map((playbook) => (
                    <div key={playbook.id} className="flex items-center justify-between gap-2 p-2 rounded border bg-card/30">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{playbook.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{playbook.task}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => void handleRunPlaybook(playbook)} disabled={loading}>
                        <Play className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
