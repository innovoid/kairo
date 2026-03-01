import { useState, useEffect } from 'react';
import { Server, KeyRound, Building2, Settings, TerminalSquare, Code2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { KairoLogoSimple } from '@/components/ui/logo';

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
    <div className="flex flex-col w-[260px] border-r border-border bg-[var(--surface-1)] shrink-0 py-6 px-6 gap-10 justify-between">
      {/* Top Section */}
      <div className="flex flex-col gap-10">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <KairoLogoSimple size={32} />
          <span className="text-sm font-medium text-foreground">archterm</span>
        </div>

        {/* Navigation */}
        <nav aria-label="Main navigation" className="flex flex-col gap-1">
          <NavButton
            icon={TerminalSquare}
            label="Terminals"
            active={activeView === 'hosts'}
            onClick={onGoHome}
            ariaLabel="Navigate to Terminals page"
          />
          <NavButton
            icon={Server}
            label="Hosts"
            active={activeView === 'hosts'}
            onClick={onGoHome}
            ariaLabel="Navigate to Hosts page"
          />
          <NavButton
            icon={KeyRound}
            label="SSH Keys"
            active={activeView === 'keys'}
            onClick={onGoKeys}
            ariaLabel="Navigate to SSH Keys page"
          />
          <NavButton
            icon={Code2}
            label="Snippets"
            active={activeView === 'snippets'}
            onClick={onOpenSnippets}
            ariaLabel="Navigate to Snippets page"
          />
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="flex flex-col gap-6">
        <div className="h-px w-full bg-[var(--border-subtle)]" />
        <NavButton
          icon={Settings}
          label="Settings"
          active={activeView === 'settings'}
          onClick={onOpenSettings}
          ariaLabel="Navigate to Settings page"
        />
      </div>
    </div>
  );
}

function NavButton({
  icon: Icon,
  label,
  active,
  onClick,
  ariaLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      aria-label={ariaLabel || label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded transition-all duration-300 ease-out w-full text-left',
        active
          ? 'bg-[var(--surface-2)] text-[var(--primary)] border-l-[3px] border-[var(--primary)] pl-[9px]'
          : 'text-[var(--text-secondary)] hover:text-foreground hover:bg-[var(--surface-1)] border-l-[3px] border-transparent',
      )}
      onClick={onClick}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </button>
  );
}
