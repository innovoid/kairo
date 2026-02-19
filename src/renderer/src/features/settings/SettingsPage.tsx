import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/stores/settings-store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AiProvider } from '@shared/types/settings';
import type { WorkspaceMember, WorkspaceRole } from '@shared/types/workspace';

export type SettingsTab = 'terminal' | 'appearance' | 'ai' | 'team';

interface SettingsPageProps {
  activeTab: SettingsTab;
  onTabChange: (tab: string) => void;
  workspaceId: string;
}

export function SettingsPage({ activeTab, onTabChange, workspaceId }: SettingsPageProps) {
  return (
    <div className="flex flex-col flex-1 h-full bg-background overflow-hidden">
      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={onTabChange} orientation="vertical" className="flex flex-1 overflow-hidden">
          {/* Nav wrapper — full height, owns the border */}
          <div className="w-44 shrink-0 border-r bg-muted/10 flex flex-col">
            <TabsList className="flex flex-col w-full rounded-none bg-transparent p-2 gap-0.5 justify-start">
              <TabsTrigger value="terminal" className="w-full justify-start px-3 py-1.5 text-sm">Terminal</TabsTrigger>
              <TabsTrigger value="appearance" className="w-full justify-start px-3 py-1.5 text-sm">Appearance</TabsTrigger>
              <TabsTrigger value="ai" className="w-full justify-start px-3 py-1.5 text-sm">AI</TabsTrigger>
              <TabsTrigger value="team" className="w-full justify-start px-3 py-1.5 text-sm">Team</TabsTrigger>
            </TabsList>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            <TabsContent value="terminal" className="p-6 m-0">
              <TerminalTab />
            </TabsContent>
            <TabsContent value="appearance" className="p-6 m-0">
              <AppearanceTab />
            </TabsContent>
            <TabsContent value="ai" className="p-6 m-0">
              <AiTab />
            </TabsContent>
            <TabsContent value="team" className="p-6 m-0">
              <TeamTab workspaceId={workspaceId} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Terminal Tab ─────────────────────────────────────────────────────────────

function TerminalTab() {
  const { settings, fetchSettings, updateSettings } = useSettingsStore();
  const [terminalFont, setTerminalFont] = useState('JetBrains Mono');
  const [terminalFontSize, setTerminalFontSize] = useState('14');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (settings) {
      setTerminalFont(settings.terminalFont);
      setTerminalFontSize(String(settings.terminalFontSize));
    }
  }, [settings]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateSettings({ terminalFont, terminalFontSize: parseInt(terminalFontSize) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1">Terminal</h2>
        <p className="text-sm text-muted-foreground">Font and display settings for the terminal emulator.</p>
      </div>
      <Separator />
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Font Family</Label>
          <Select value={terminalFont} onValueChange={(v) => { if (v) setTerminalFont(v); }}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="JetBrains Mono">JetBrains Mono</SelectItem>
              <SelectItem value="Fira Code">Fira Code</SelectItem>
              <SelectItem value="Cascadia Code">Cascadia Code</SelectItem>
              <SelectItem value="Source Code Pro">Source Code Pro</SelectItem>
              <SelectItem value="Menlo">Menlo</SelectItem>
              <SelectItem value="Monaco">Monaco</SelectItem>
              <SelectItem value="Consolas">Consolas</SelectItem>
              <SelectItem value="Courier New">Courier New</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Font Size</Label>
          <Input type="number" value={terminalFontSize} onChange={(e) => setTerminalFontSize(e.target.value)} min={8} max={32} className="w-24" />
        </div>
      </div>
      <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</Button>
    </div>
  );
}

// ─── Appearance Tab ───────────────────────────────────────────────────────────

function AppearanceTab() {
  const { settings, fetchSettings, updateSettings } = useSettingsStore();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSettings(); }, []);
  useEffect(() => { if (settings) setTheme(settings.theme); }, [settings]);

  async function handleSave() {
    setSaving(true);
    try { await updateSettings({ theme }); } finally { setSaving(false); }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1">Appearance</h2>
        <p className="text-sm text-muted-foreground">Color theme and visual preferences.</p>
      </div>
      <Separator />
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Theme</Label>
          <Select value={theme} onValueChange={(v) => { if (v) setTheme(v as 'dark' | 'light'); }}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="light">Light</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</Button>
    </div>
  );
}

// ─── AI Tab ───────────────────────────────────────────────────────────────────

function AiTab() {
  const { settings, fetchSettings, updateSettings } = useSettingsStore();
  const [aiProvider, setAiProvider] = useState<AiProvider>('openai');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSettings(); }, []);
  useEffect(() => { if (settings) setAiProvider(settings.aiProvider); }, [settings]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateSettings({
        aiProvider,
        openaiApiKey: openaiKey || undefined,
        anthropicApiKey: anthropicKey || undefined,
        geminiApiKey: geminiKey || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1">AI Assistant</h2>
        <p className="text-sm text-muted-foreground">Configure AI providers and API keys for the AI assistant panel.</p>
      </div>
      <Separator />
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Default Provider</Label>
          <Select value={aiProvider} onValueChange={(v) => { if (v) setAiProvider(v as AiProvider); }}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
              <SelectItem value="gemini">Gemini</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>OpenAI API Key</Label>
          <Input type="password" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} placeholder="sk-..." className="font-mono" />
        </div>
        <div className="space-y-2">
          <Label>Anthropic API Key</Label>
          <Input type="password" value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)} placeholder="sk-ant-..." className="font-mono" />
        </div>
        <div className="space-y-2">
          <Label>Gemini API Key</Label>
          <Input type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="AIza..." className="font-mono" />
        </div>
      </div>
      <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</Button>
    </div>
  );
}

// ─── Team Tab ─────────────────────────────────────────────────────────────────

function TeamTab({ workspaceId }: { workspaceId: string }) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member');
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    window.workspaceApi.members.list(workspaceId).then((m) => setMembers(m as WorkspaceMember[]));
  }, [workspaceId]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInviting(true);
    try {
      await window.workspaceApi.invite({ workspaceId, email: inviteEmail, role: inviteRole });
      setInviteEmail('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setInviting(false);
    }
  }

  async function removeMember(userId: string) {
    await window.workspaceApi.members.remove(workspaceId, userId);
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1">Team</h2>
        <p className="text-sm text-muted-foreground">Manage workspace members and send invitations.</p>
      </div>
      <Separator />

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Members ({members.length})</h3>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No members found.</p>
        ) : (
          members.map((m) => (
            <div key={m.userId} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <span className="text-sm truncate flex-1">{m.email}</span>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <Badge variant="outline" className="text-xs capitalize">{m.role}</Badge>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => removeMember(m.userId)}>
                  Remove
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-sm font-medium">Invite member</h3>
        <form onSubmit={handleInvite} className="flex gap-2">
          <Input type="email" placeholder="Email address" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required className="flex-1" />
          <Select value={inviteRole} onValueChange={(v) => { if (v) setInviteRole(v as WorkspaceRole); }}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" size="default" disabled={inviting}>
            {inviting ? 'Sending...' : 'Invite'}
          </Button>
        </form>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
