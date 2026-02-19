import { useEffect, useState } from 'react';
import type { WorkspaceMember, WorkspaceInvite, WorkspaceRole } from '@shared/types/workspace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface WorkspaceMembersPanelProps {
  workspaceId: string;
}

export function WorkspaceMembersPanel({ workspaceId }: WorkspaceMembersPanelProps) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.workspaceApi.members.list(workspaceId).then((m) => setMembers(m as WorkspaceMember[]));
  }, [workspaceId]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await window.workspaceApi.invite({
        workspaceId,
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteEmail('');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function removeMember(userId: string) {
    await window.workspaceApi.members.remove(workspaceId, userId);
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-2">Members</h3>
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.userId} className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground truncate">{m.userId}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{m.role}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-destructive"
                  onClick={() => removeMember(m.userId)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="text-sm font-medium mb-2">Invite member</h3>
        <form onSubmit={handleInvite} className="space-y-2">
          <Input
            type="email"
            placeholder="Email address"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />
          <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as WorkspaceRole)}>
            <SelectTrigger>
              <SelectValue>
                {inviteRole === 'member' ? 'Member' : 'Admin'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" size="sm" className="w-full">Send Invite</Button>
        </form>
      </div>
    </div>
  );
}
