import { useWorkspaceStore } from '../../stores/workspace-store';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

export function WorkspaceSwitcher() {
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspaceStore();

  return (
    <Select
      value={activeWorkspace?.id ?? ''}
      onValueChange={setActiveWorkspace}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select workspace">
          {activeWorkspace?.name ?? 'Select workspace'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {workspaces.map((workspace) => (
          <SelectItem key={workspace.id} value={workspace.id}>
            {workspace.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
