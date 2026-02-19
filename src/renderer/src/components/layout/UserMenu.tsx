import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AvatarInitials } from '@/components/ui/avatar-initials';
import { User as UserIcon, Settings, LogOut } from 'lucide-react';
import { toast } from 'sonner';

interface UserMenuProps {
  children: React.ReactNode;
}

export function UserMenu({ children }: UserMenuProps) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
  }, []);

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      await window.authApi.setAccessToken(null);
      toast.success('Logged out successfully');
      // AuthGate will detect session loss and redirect
    } catch (error) {
      toast.error('Failed to log out');
      console.error('Logout error:', error);
    }
  }

  function handleProfile() {
    navigate('/profile');
  }

  function handleAccountSettings() {
    navigate('/settings?tab=account');
  }

  if (!user) {
    return <>{children}</>;
  }

  const userName = user.user_metadata?.name || 'User';
  const userEmail = user.email || '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={(props) => {
        const child = children as React.ReactElement;
        return React.cloneElement(child, props);
      }} />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex items-center gap-3">
            <AvatarInitials name={userName} size="sm" />
            <div className="flex flex-col overflow-hidden">
              <span className="font-medium truncate">{userName}</span>
              <span className="text-xs text-muted-foreground truncate">{userEmail}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleProfile}>
          <UserIcon className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleAccountSettings}>
          <Settings className="mr-2 h-4 w-4" />
          Account Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Log Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
