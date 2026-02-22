import { useState } from 'react';
import type { Terminal } from '@xterm/xterm';
import type { Tab } from '@/stores/session-store';
import { useSessionStore } from '@/stores/session-store';
import { useBroadcastStore } from '@/stores/broadcast-store';
import { useRecordingStore } from '@/stores/recording-store';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { X, FolderOpen, SplitSquareHorizontal, SplitSquareVertical, Radio, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { RecordingControls } from './RecordingControls';

interface TerminalToolbarProps {
  tab: Tab;
  terminal: React.RefObject<Terminal | null>;
  onSplit?: (direction: 'horizontal' | 'vertical') => void;
  onClosePane?: () => void;
}

export function TerminalToolbar({ tab, terminal, onSplit, onClosePane }: TerminalToolbarProps) {
  const { closeTab, openTab, tabs } = useSessionStore();
  const { enabled, targetSessionIds, toggle, addTarget, removeTarget } = useBroadcastStore();
  const { isRecording, startRecording, stopRecording } = useRecordingStore();
  const [recordingState, setRecordingState] = useState(false);

  function disconnect() {
    if (tab.sessionId) {
      window.sshApi.disconnect(tab.sessionId).catch(() => {});
    }
    closeTab(tab.tabId);
  }

  function openSftp() {
    const sftpTabId = `sftp-${tab.sessionId}`;
    openTab({
      tabId: sftpTabId,
      tabType: 'sftp',
      label: `SFTP: ${tab.label}`,
      hostId: tab.hostId,
      hostname: tab.hostname,
      sessionId: tab.sessionId,
      status: 'connected',
    });
  }

  function toggleBroadcast() {
    if (!enabled && tab.sessionId) {
      // Enable and add this session as a target
      toggle();
      addTarget(tab.sessionId);
    } else {
      // Disable
      toggle();
    }
  }

  async function toggleRecording() {
    if (!tab.sessionId) return;

    const currentlyRecording = isRecording(tab.sessionId);

    if (!currentlyRecording) {
      // Start recording
      const term = terminal.current;
      if (!term) {
        toast.error('Terminal not ready');
        return;
      }
      const cols = term.cols;
      const rows = term.rows;
      await window.recordingApi.start(tab.sessionId, cols, rows);
      startRecording(tab.sessionId);
      setRecordingState(true);
      toast.success('Recording started');
    } else {
      // Stop recording
      const filepath = await window.recordingApi.stop(tab.sessionId);
      stopRecording(tab.sessionId);
      setRecordingState(false);
      if (filepath) {
        toast.success(`Recording saved: ${filepath}`);
      } else {
        toast.error('Failed to save recording');
      }
    }
  }

  // Get all connected terminal sessions
  const allTerminalSessions = [...tabs.values()]
    .filter((t) => t.tabType === 'terminal' && t.sessionId && t.status === 'connected')
    .map((t) => ({ sessionId: t.sessionId!, label: t.label }));

  return (
    <div className="flex items-center gap-2 px-3 h-9 border-b bg-card/50 backdrop-blur-sm shrink-0">
      <div className={cn('w-2 h-2 rounded-full shrink-0 transition-colors duration-200',
        tab.status === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' :
        tab.status === 'connecting' ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)] animate-pulse' :
        tab.status === 'error' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-muted-foreground/30'
      )} />
      <span className="text-xs text-muted-foreground/80 font-mono tracking-wide">
        {tab.hostname} <span className="text-muted-foreground/50">—</span> {tab.label}
      </span>
      <div className="ml-auto flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-7 px-2 text-xs hover:bg-accent/50', recordingState && 'text-red-500 hover:text-red-600')}
          onClick={toggleRecording}
          title={recordingState ? 'Stop recording' : 'Start recording'}
        >
          <Circle className={cn('h-3.5 w-3.5 transition-all', recordingState && 'fill-red-500')} />
        </Button>
        <RecordingControls />
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs hover:bg-accent/50" onClick={openSftp} title="Open SFTP">
          <FolderOpen className="h-3.5 w-3.5" />
        </Button>
        {onSplit && (
          <>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs hover:bg-accent/50" onClick={() => onSplit('horizontal')} title="Split horizontal">
              <SplitSquareHorizontal className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs hover:bg-accent/50" onClick={() => onSplit('vertical')} title="Split vertical">
              <SplitSquareVertical className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-7 px-2 text-xs hover:bg-accent/50', enabled && 'text-primary hover:text-primary')}
          onClick={toggleBroadcast}
          title={enabled ? 'Disable broadcast' : 'Enable broadcast'}
        >
          <Radio className="h-3.5 w-3.5" />
        </Button>
        {enabled && (
          <Popover>
            <PopoverTrigger
              render={
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" title="Broadcast targets">
                  <span className="text-blue-500">({targetSessionIds.length})</span>
                </Button>
              }
            />
            <PopoverContent className="w-64 p-2" align="end">
              <div className="text-xs font-semibold mb-2">Broadcast Targets</div>
              <div className="space-y-2">
                {allTerminalSessions.map(({ sessionId, label }) => (
                  <div key={sessionId} className="flex items-center space-x-2">
                    <Checkbox
                      id={`broadcast-${sessionId}`}
                      checked={targetSessionIds.includes(sessionId)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          addTarget(sessionId);
                        } else {
                          removeTarget(sessionId);
                        }
                      }}
                    />
                    <label
                      htmlFor={`broadcast-${sessionId}`}
                      className="text-xs cursor-pointer flex-1"
                    >
                      {label}
                    </label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
        {onClosePane ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={onClosePane}
            title="Close pane"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-destructive hover:text-destructive"
            onClick={disconnect}
            title="Disconnect"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
