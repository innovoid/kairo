import { useState, useEffect } from 'react';
import { Server, KeyRound, Building2, Settings, TerminalSquare, Code2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { ArchTermLogoSimple } from '@/components/ui/logo';

interface SidebarProps {
  onOpenSettings: () => void;
  onGoHome: () => void;
  onGoKeys: () => void;
  onGoWorkspace: () => void;
  onOpenProfile: () => void;
  onOpenLocalTerminal: () => void;
  onOpenSnippets: () => void;
  activeView: 'hosts' | 'keys' | 'workspace' | 'settings' | 'profile' | 'snippets';
}

export function Sidebar({ onOpenSettings, onGoHome, onGoKeys, onGoWorkspace, onOpenProfile, onOpenLocalTerminal, onOpenSnippets, activeView }: SidebarProps) {
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
    <div className="flex flex-col w-[280px] border-r border-border bg-background shrink-0 py-10 px-7 gap-10 justify-between">
      {/* Top Section */}
      <div className="flex flex-col gap-10">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <ArchTermLogoSimple size={32} />
          <span className="text-sm font-medium text-foreground">archterm</span>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1">
          <NavButton icon={TerminalSquare} label="Terminals" active={activeView === 'hosts'} onClick={onGoHome} />
          <NavButton icon={Server} label="Hosts" active={activeView === 'hosts'} onClick={onGoHome} />
          <NavButton icon={KeyRound} label="SSH Keys" active={activeView === 'keys'} onClick={onGoKeys} />
          <NavButton icon={Code2} label="Snippets" active={activeView === 'snippets'} onClick={onOpenSnippets} />
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="flex flex-col gap-6">
        <div className="h-px w-full bg-border" />
        <NavButton icon={Settings} label="Settings" active={activeView === 'settings'} onClick={onOpenSettings} />
      </div>
    </div>
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
    <button
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded transition-colors w-full text-left',
        active
          ? 'bg-[#1A1A1A] text-[#C9A962]'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
      )}
      onClick={onClick}
    >
      <Icon className="h-[18px] w-[18px]" />
      <span className="text-sm">{label}</span>
    </button>
  );
}
