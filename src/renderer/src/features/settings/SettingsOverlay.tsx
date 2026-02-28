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
    <Overlay open={open} onOpenChange={onOpenChange} className="max-w-[960px] max-h-[88vh]">
      {/* Compact header bar */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-subtle)]">
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

      <OverlayContent className="p-0 max-h-[calc(88vh-52px)]">
        <div className="h-full" style={{ minHeight: '520px' }}>
          <SettingsPage
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as SettingsTab)}
            workspaceId={workspaceId}
          />
        </div>
      </OverlayContent>
    </Overlay>
  );
}
