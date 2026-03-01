import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';
import { InviteMemberDialog } from './InviteMemberDialog';
import type { WorkspaceMember, WorkspaceRole } from '@shared/types/workspace';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface TeamPageProps {
  workspaceId: string;
}

export function TeamPage({ workspaceId }: TeamPageProps) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  async function loadMembers() {
    setLoading(true);
    setError(null);
    try {
      const data = await window.workspaceApi.members.list(workspaceId);
      setMembers(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load members';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(userId: string, role: WorkspaceRole) {
    setPendingUserId(userId);
    try {
      await window.workspaceApi.members.updateRole({ workspaceId, userId, role });
      await loadMembers();
      toast.success('Member role updated');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to update member role';
      toast.error(message);
    } finally {
      setPendingUserId(null);
    }
  }

  async function handleRemove(userId: string) {
    if (!window.confirm('Remove this member from the workspace?')) return;
    setPendingUserId(userId);
    try {
      await window.workspaceApi.members.remove(workspaceId, userId);
      await loadMembers();
      toast.success('Member removed');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to remove member';
      toast.error(message);
    } finally {
      setPendingUserId(null);
    }
  }

  function getRoleBadgeColor(role: WorkspaceRole) {
    switch (role) {
      case 'owner': return 'bg-amber-500';
      case 'admin': return 'bg-blue-500';
      case 'member': return 'bg-gray-500';
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Team</h1>
            <p className="text-sm text-muted-foreground">Manage workspace members and permissions</p>
          </div>
          <InviteMemberDialog workspaceId={workspaceId} onInvited={loadMembers} />
        </div>

        {/* Members List */}
        {loading ? (
          <div className="text-center py-20">
            <p className="text-sm text-muted-foreground">Loading members...</p>
          </div>
        ) : error ? (
          <div className="text-center py-20 space-y-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void loadMembers()}>
              Retry
            </Button>
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-20">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-sm font-medium">No members yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Invite team members to collaborate
            </p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.userId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-medium">
                            {member.email.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium">{member.email}</p>
                          <p className="text-xs text-muted-foreground font-mono">{member.userId}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {member.role === 'owner' ? (
                        <Badge className={getRoleBadgeColor(member.role)}>
                          {member.role}
                        </Badge>
                      ) : (
                        <Select
                          value={member.role}
                          onValueChange={(role) => handleRoleChange(member.userId, role as WorkspaceRole)}
                          disabled={pendingUserId === member.userId}
                        >
                          <SelectTrigger className="w-28 h-8">
                            <SelectValue>
                              {member.role === 'admin' ? 'Admin' : 'Member'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(member.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {member.role !== 'owner' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(member.userId)}
                          className="text-destructive hover:text-destructive"
                          disabled={pendingUserId === member.userId}
                        >
                          Remove
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
