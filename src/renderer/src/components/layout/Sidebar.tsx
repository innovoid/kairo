import { useState, useEffect } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { Server, KeyRound, Building2, Settings, TerminalSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { AvatarInitials } from '@/components/ui/avatar-initials';
import { UserMenu } from '@/components/layout/UserMenu';
import { WorkspaceSwitcher } from '@/features/workspaces/WorkspaceSwitcher';

interface SidebarProps {
  onOpenSettings: () => void;
  onGoHome: () => void;
  onGoKeys: () => void;
  onGoWorkspace: () => void;
  onOpenProfile: () => void;
  onOpenLocalTerminal: () => void;
  activeView: 'hosts' | 'keys' | 'workspace' | 'settings' | 'profile';
}

export function Sidebar({ onOpenSettings, onGoHome, onGoKeys, onGoWorkspace, onOpenProfile, onOpenLocalTerminal, activeView }: SidebarProps) {
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState('User');

  useEffect(() => {
    async function loadUser() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      if (authUser) {
        // Load name from public.users
        const { data: profile } = await supabase
          .from('users')
          .select('name')
          .eq('id', authUser.id)
          .single();

        setUserName(profile?.name || authUser.email || 'User');
      }
    }
    loadUser();
  }, []);

  return (
    <TooltipProvider delay={300}>
      <div className="flex flex-col items-center w-14 border-r bg-muted/10 shrink-0 py-2 gap-1">
        {/* Workspace Switcher */}
        <div className="w-full px-1 mb-2 flex justify-center">
          <WorkspaceSwitcher />
        </div>

        {/* Navigation */}
        <NavButton icon={Server} label="Hosts" active={activeView === 'hosts'} onClick={onGoHome} />
        <NavButton icon={KeyRound} label="SSH Keys" active={activeView === 'keys'} onClick={onGoKeys} />
        <NavButton icon={Building2} label="Workspace" active={activeView === 'workspace'} onClick={onGoWorkspace} />
        <NavButton icon={TerminalSquare} label="Local Terminal" onClick={onOpenLocalTerminal} />

        <div className="flex-1" />

        {/* Bottom */}
        {user && (
          <Tooltip>
            <TooltipTrigger
              className={cn(
                'inline-flex items-center justify-center h-9 w-9 rounded-md transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                activeView === 'profile' && 'bg-accent text-accent-foreground',
              )}
              onClick={onOpenProfile}
            >
              <AvatarInitials name={userName} size="sm" />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Profile
            </TooltipContent>
          </Tooltip>
        )}
        <NavButton icon={Settings} label="Settings" active={activeView === 'settings'} onClick={onOpenSettings} />
      </div>
    </TooltipProvider>
  );
}

function NavButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        className={cn(
          'inline-flex items-center justify-center h-9 w-9 rounded-md transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          active && 'bg-accent text-accent-foreground',
        )}
        onClick={onClick}
      >
        <Icon className="h-5 w-5" />
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
