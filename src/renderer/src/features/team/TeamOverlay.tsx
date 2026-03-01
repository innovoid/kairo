import { Overlay, OverlayContent, OverlayHeader } from '@/components/ui/overlay';
import { TeamPage } from './TeamPage';

interface TeamOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

export function TeamOverlay({ open, onOpenChange, workspaceId }: TeamOverlayProps) {
  return (
    <Overlay open={open} onOpenChange={onOpenChange} className="max-w-[1200px] max-h-[88vh]">
      <OverlayHeader
        title="Team"
        description="Invite members and manage workspace roles"
        onClose={() => onOpenChange(false)}
      />
      <OverlayContent className="p-0 max-h-[calc(88vh-88px)]">
        <TeamPage workspaceId={workspaceId} />
      </OverlayContent>
    </Overlay>
  );
}
