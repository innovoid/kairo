import { useState } from 'react';
import type { Tab } from '@/stores/session-store';
import { FilePane } from './FilePane';
import { LocalFilePane } from './LocalFilePane';
import { TransferProgress } from './TransferProgress';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { Server, HardDrive, ChevronRight } from 'lucide-react';

interface SftpTabProps {
  tab: Tab;
}

export function SftpTab({ tab }: SftpTabProps) {
  // Use the underlying SSH session ID (strip the 'sftp-' prefix)
  const sshSessionId = tab.sessionId!.replace(/^sftp-/, '');
  const [remotePath, setRemotePath] = useState('/');

  return (
    <div className="flex flex-col h-full bg-[var(--surface-0)]">
      {/* Breadcrumb header */}
      <div className="flex items-center gap-2 px-4 h-10 border-b border-[var(--border-subtle)] bg-[var(--surface-1)] shrink-0">
        <Server className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-xs font-medium text-foreground font-mono">
          {tab.hostname ?? 'Remote'}
        </span>
        <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground font-mono truncate">{remotePath}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <HardDrive className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Local</span>
        </div>
      </div>

      {/* Panes */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize={58} minSize={30}>
            <FilePane sessionId={sshSessionId} title="Remote" onPathChange={setRemotePath} />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={42} minSize={25}>
            <LocalFilePane sessionId={sshSessionId} remotePath={remotePath} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <TransferProgress />
    </div>
  );
}

