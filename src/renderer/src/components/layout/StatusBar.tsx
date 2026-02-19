import { useSessionStore } from '@/stores/session-store';
import { useTransferStore } from '@/stores/transfer-store';
import { Terminal, ArrowUpDown } from 'lucide-react';

export function StatusBar() {
  const tabs = useSessionStore((s) => s.tabs);
  const transfers = useTransferStore((s) => s.transfers);

  const connected = [...tabs.values()].filter(
    (t) => (t.tabType === 'terminal' || t.tabType === 'sftp') && t.status === 'connected'
  ).length;
  const activeTransfers = [...transfers.values()].filter((t) => t.status === 'active').length;

  return (
    <div className="flex items-center gap-4 px-3 h-6 border-t bg-muted/20 text-xs text-muted-foreground shrink-0">
      <div className="flex items-center gap-1">
        <Terminal className="h-3 w-3" />
        <span>{connected} connected</span>
      </div>
      {activeTransfers > 0 && (
        <div className="flex items-center gap-1">
          <ArrowUpDown className="h-3 w-3" />
          <span>{activeTransfers} transfer{activeTransfers !== 1 ? 's' : ''}</span>
        </div>
      )}
      <div className="ml-auto">ArchTerm</div>
    </div>
  );
}
