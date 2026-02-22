import { useEffect, useState } from 'react';
import { Overlay, OverlayContent, OverlayHeader } from '@/components/ui/overlay';
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
    if (open) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  return (
    <Overlay open={open} onOpenChange={onOpenChange} className="max-w-[1320px] max-h-[92vh]">
      <OverlayHeader
        title="Settings"
        description="Terminal, appearance, AI, and account preferences"
        onClose={() => onOpenChange(false)}
      />
      <OverlayContent className="p-0 max-h-[calc(92vh-88px)]">
        <SettingsPage
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as SettingsTab)}
          workspaceId={workspaceId}
        />
      </OverlayContent>
    </Overlay>
  );
}
