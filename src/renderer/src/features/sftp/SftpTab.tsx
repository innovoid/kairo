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

interface SftpTabProps {
  tab: Tab;
}

export function SftpTab({ tab }: SftpTabProps) {
  // Use the underlying SSH session ID (strip the 'sftp-' prefix)
  const sshSessionId = tab.sessionId!.replace(/^sftp-/, '');
  const [remotePath, setRemotePath] = useState('/');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-3 h-8 border-b bg-muted/20 shrink-0">
        <span className="text-xs text-muted-foreground">
          SFTP — {tab.hostname}
        </span>
      </div>
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
