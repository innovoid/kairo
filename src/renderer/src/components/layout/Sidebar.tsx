import { useState, useEffect } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { SquareTerminal, Server, KeyRound, Users, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { AvatarInitials } from '@/components/ui/avatar-initials';
import { UserMenu } from '@/components/layout/UserMenu';

interface SidebarProps {
  onOpenSettings: () => void;
  onGoHome: () => void;
  onGoKeys: () => void;
  onGoTeam: () => void;
  activeView: 'hosts' | 'keys' | 'team' | 'settings';
}

export function Sidebar({ onOpenSettings, onGoHome, onGoKeys, onGoTeam, activeView }: SidebarProps) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  const userName = user?.user_metadata?.name || 'User';

  return (
    <TooltipProvider delay={300}>
      <div className="flex flex-col items-center w-14 border-r bg-muted/10 shrink-0 py-2 gap-1">
        {/* Logo */}
        <div className="flex items-center justify-center h-9 w-9 mb-2">
          <SquareTerminal className="h-6 w-6 text-primary" />
        </div>

        {/* Navigation */}
        <NavButton icon={Server} label="Hosts" active={activeView === 'hosts'} onClick={onGoHome} />
        <NavButton icon={KeyRound} label="SSH Keys" active={activeView === 'keys'} onClick={onGoKeys} />
        <NavButton icon={Users} label="Team" active={activeView === 'team'} onClick={onGoTeam} />

        <div className="flex-1" />

        {/* Bottom */}
        {user && (
          <Tooltip>
            <UserMenu>
              <TooltipTrigger
                className={cn(
                  'inline-flex items-center justify-center h-9 w-9 rounded-md transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <AvatarInitials name={userName} size="sm" />
              </TooltipTrigger>
            </UserMenu>
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
