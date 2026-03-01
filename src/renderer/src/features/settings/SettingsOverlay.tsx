import { useEffect, useState } from 'react';
import { Overlay, OverlayContent } from '@/components/ui/overlay';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SettingsPage, type SettingsTab } from './SettingsPage';

interface SettingsOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  initialTab?: SettingsTab;
}

export function SettingsOverlay({
  open,
  onOpenChange,
  workspaceId,
  initialTab = 'terminal',
}: SettingsOverlayProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  useEffect(() => {
    if (open) setActiveTab(initialTab);
  }, [open, initialTab]);

  return (
    <Overlay open={open} onOpenChange={onOpenChange} className="max-w-240 max-h-[88vh] h-[88vh]">
      <div className="flex flex-col h-[calc(88vh-2px)] overflow-hidden">
        {/* Compact header bar */}
        <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-subtle)]">
          <span className="text-sm font-semibold text-foreground">Settings</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-7 w-7 p-0 rounded-lg text-[var(--text-tertiary)] hover:text-foreground hover:bg-[var(--surface-3)] transition-all duration-200 hover:scale-110 hover:rotate-90 active:scale-95"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <OverlayContent className="p-0 flex-1 min-h-0 overflow-hidden">
          <SettingsPage
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as SettingsTab)}
            workspaceId={workspaceId}
          />
        </OverlayContent>
      </div>
    </Overlay>
  );
}
