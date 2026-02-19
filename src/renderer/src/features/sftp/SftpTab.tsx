import type { Tab } from '@/stores/session-store';
import { FilePane } from './FilePane';
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-3 h-8 border-b bg-muted/20 shrink-0">
        <span className="text-xs text-muted-foreground">
          SFTP — {tab.hostname}
        </span>
      </div>
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize={100}>
            <FilePane sessionId={sshSessionId} title="Remote" />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={0} minSize={0}>
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Local filesystem
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <TransferProgress />
    </div>
  );
}
