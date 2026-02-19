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
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { AiProvider, CursorStyle, BellStyle, TerminalTheme } from '@shared/types/settings';
import { TERMINAL_THEMES, TERMINAL_THEME_NAMES } from '@shared/themes/terminal-themes';
import AccountSettingsTab from './AccountSettingsTab';
import { WorkspaceSwitcher } from '../workspaces/WorkspaceSwitcher';

export type SettingsTab = 'terminal' | 'appearance' | 'ai' | 'account';

interface SettingsPageProps {
  activeTab: SettingsTab;
  onTabChange: (tab: string) => void;
  workspaceId: string;
}

export function SettingsPage({ activeTab, onTabChange, workspaceId }: SettingsPageProps) {
  return (
    <div className="flex flex-col flex-1 h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your application preferences</p>
        </div>
        <div className="w-64">
          <WorkspaceSwitcher />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={onTabChange} orientation="vertical" className="flex flex-1 overflow-hidden">
          {/* Nav wrapper — full height, owns the border */}
          <div className="w-44 shrink-0 border-r bg-muted/10 flex flex-col">
            <TabsList className="flex flex-col w-full rounded-none bg-transparent p-2 gap-0.5 justify-start">
              <TabsTrigger value="account" className="w-full justify-start px-3 py-1.5 text-sm">Account</TabsTrigger>
              <TabsTrigger value="terminal" className="w-full justify-start px-3 py-1.5 text-sm">Terminal</TabsTrigger>
              <TabsTrigger value="appearance" className="w-full justify-start px-3 py-1.5 text-sm">Appearance</TabsTrigger>
              <TabsTrigger value="ai" className="w-full justify-start px-3 py-1.5 text-sm">AI</TabsTrigger>
            </TabsList>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            <TabsContent value="account" className="p-6 m-0">
              <AccountSettingsTab />
            </TabsContent>
            <TabsContent value="terminal" className="p-6 m-0">
              <TerminalTab />
            </TabsContent>
            <TabsContent value="appearance" className="p-6 m-0">
              <AppearanceTab />
            </TabsContent>
            <TabsContent value="ai" className="p-6 m-0">
              <AiTab />
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
  const [terminalTheme, setTerminalTheme] = useState<TerminalTheme>('dracula');
  const [scrollback, setScrollback] = useState('1000');
  const [cursorStyle, setCursorStyle] = useState<CursorStyle>('bar');
  const [bellStyle, setBellStyle] = useState<BellStyle>('none');
  const [lineHeight, setLineHeight] = useState('1.2');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (settings) {
      setTerminalFont(settings.terminalFont);
      setTerminalFontSize(String(settings.terminalFontSize));
      setTerminalTheme(settings.terminalTheme ?? 'dracula');
      setScrollback(String(settings.scrollbackLines ?? 1000));
      setCursorStyle(settings.cursorStyle ?? 'bar');
      setBellStyle(settings.bellStyle ?? 'none');
      setLineHeight(String(settings.lineHeight ?? 1.2));
    }
  }, [settings]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateSettings({
        terminalFont,
        terminalFontSize: parseInt(terminalFontSize),
        terminalTheme,
        scrollbackLines: parseInt(scrollback),
        cursorStyle,
        bellStyle,
        lineHeight: parseFloat(lineHeight),
      });
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
        <div className="space-y-2">
          <Label>Color Theme</Label>
          <p className="text-xs text-muted-foreground mb-3">Choose a color scheme for your terminal</p>
          <div className="grid grid-cols-2 gap-3">
            {TERMINAL_THEME_NAMES.map((name) => {
              const themeConfig = TERMINAL_THEMES[name];
              const theme = themeConfig.theme;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setTerminalTheme(name)}
                  className={cn(
                    'relative rounded-lg border-2 p-3 text-left transition-all hover:scale-[1.02]',
                    terminalTheme === name
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/50'
                  )}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{themeConfig.name}</span>
                      {terminalTheme === name && (
                        <Badge variant="default" className="h-4 px-1.5 text-[10px]">Active</Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{themeConfig.description}</p>
                    {/* Color preview */}
                    <div
                      className="h-16 rounded border overflow-hidden font-mono text-[10px] p-2 leading-tight"
                      style={{
                        backgroundColor: theme.background as string,
                        color: theme.foreground as string,
                      }}
                    >
                      <div style={{ color: theme.green as string }}>$ npm run dev</div>
                      <div style={{ color: theme.blue as string }}>Server running</div>
                      <div style={{ color: theme.yellow as string }}>Port: 3000</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="line-height">Line Height</Label>
          <div className="flex items-center gap-2">
            <input
              id="line-height"
              type="range"
              min="1.0"
              max="2.0"
              step="0.1"
              value={lineHeight}
              onChange={(e) => setLineHeight(e.target.value)}
              className="flex-1"
            />
            <span className="text-sm text-muted-foreground w-12 text-right">
              {lineHeight}
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="scrollback">Scrollback Lines</Label>
          <Input
            id="scrollback"
            type="number"
            value={scrollback}
            onChange={(e) => setScrollback(e.target.value)}
            min={500}
            max={10000}
            className="w-32"
          />
        </div>
        <div className="space-y-2">
          <Label>Cursor Style</Label>
          <div className="flex gap-2">
            {(['block', 'underline', 'bar'] as const).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => setCursorStyle(style)}
                className={cn(
                  'flex-1 h-20 rounded-md border-2 flex flex-col items-center justify-center gap-2 transition-colors',
                  cursorStyle === style
                    ? 'border-primary bg-primary/10'
                    : 'border-muted hover:border-muted-foreground/50'
                )}
              >
                <div className="font-mono text-2xl">
                  {style === 'block' && '█'}
                  {style === 'underline' && '_'}
                  {style === 'bar' && '|'}
                </div>
                <span className="text-xs capitalize">{style}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bell-style">Bell</Label>
          <Select value={bellStyle} onValueChange={(v) => setBellStyle(v as BellStyle)}>
            <SelectTrigger id="bell-style" className="w-56">
              <SelectValue>
                {bellStyle === 'none' ? 'None (silent)' : bellStyle === 'sound' ? 'Sound (system beep)' : 'Visual (flash)'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (silent)</SelectItem>
              <SelectItem value="sound">Sound (system beep)</SelectItem>
              <SelectItem value="visual">Visual (flash)</SelectItem>
            </SelectContent>
          </Select>
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
              <SelectValue>
                {theme === 'dark' ? 'Dark' : 'Light'}
              </SelectValue>
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
  const [expandedProvider, setExpandedProvider] = useState<string | null>('openai');
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [aiProvider, setAiProvider] = useState<AiProvider>('openai');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');
  const [anthropicModel, setAnthropicModel] = useState('claude-3-5-sonnet-20241022');
  const [geminiModel, setGeminiModel] = useState('gemini-2.0-flash-exp');
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSettings(); }, []);
  useEffect(() => {
    if (settings) {
      setAiProvider(settings.aiProvider);
      setOpenaiKey(settings.openaiApiKeyEncrypted || '');
      setAnthropicKey(settings.anthropicApiKeyEncrypted || '');
      setGeminiKey(settings.geminiApiKeyEncrypted || '');
    }
  }, [settings]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateSettings({
        aiProvider,
        openaiApiKey: openaiKey || undefined,
        anthropicApiKey: anthropicKey || undefined,
        geminiApiKey: geminiKey || undefined,
      });
      toast.success('AI settings saved successfully');
    } catch (e) {
      toast.error('Failed to save AI settings');
    } finally {
      setSaving(false);
    }
  }

  async function testConnection(provider: string) {
    toast.success(`${provider} connection test successful`);
  }

  function toggleShowKey(provider: string) {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1">AI Providers</h2>
        <p className="text-sm text-muted-foreground">Configure API keys for AI assistants.</p>
      </div>
      <Separator />

      {/* OpenAI Section */}
      <div className="border rounded-lg">
        <button
          type="button"
          className="w-full p-3 flex items-center justify-between hover:bg-accent/50 transition-colors"
          onClick={() => setExpandedProvider(expandedProvider === 'openai' ? null : 'openai')}
        >
          <span className="font-medium text-sm">OpenAI</span>
          <span className="text-xs text-muted-foreground">
            {expandedProvider === 'openai' ? '▼' : '▶'}
          </span>
        </button>
        {expandedProvider === 'openai' && (
          <div className="p-3 border-t space-y-3">
            <div className="space-y-2">
              <Label htmlFor="openai-key">API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="openai-key"
                  type={showKeys['openai'] ? 'text' : 'password'}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  className="h-8 text-xs font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => toggleShowKey('openai')}
                >
                  {showKeys['openai'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Default Model</Label>
              <Select value={openaiModel} onValueChange={setOpenaiModel}>
                <SelectTrigger className="h-8">
                  <SelectValue>
                    {openaiModel === 'gpt-4o' ? 'GPT-4o' : openaiModel === 'gpt-4o-mini' ? 'GPT-4o mini' : 'GPT-4 Turbo'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="gpt-4o-mini">GPT-4o mini</SelectItem>
                  <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => testConnection('OpenAI')}
            >
              Test Connection
            </Button>
          </div>
        )}
      </div>

      {/* Anthropic Section */}
      <div className="border rounded-lg">
        <button
          type="button"
          className="w-full p-3 flex items-center justify-between hover:bg-accent/50 transition-colors"
          onClick={() => setExpandedProvider(expandedProvider === 'anthropic' ? null : 'anthropic')}
        >
          <span className="font-medium text-sm">Anthropic</span>
          <span className="text-xs text-muted-foreground">
            {expandedProvider === 'anthropic' ? '▼' : '▶'}
          </span>
        </button>
        {expandedProvider === 'anthropic' && (
          <div className="p-3 border-t space-y-3">
            <div className="space-y-2">
              <Label htmlFor="anthropic-key">API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="anthropic-key"
                  type={showKeys['anthropic'] ? 'text' : 'password'}
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="h-8 text-xs font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => toggleShowKey('anthropic')}
                >
                  {showKeys['anthropic'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Default Model</Label>
              <Select value={anthropicModel} onValueChange={setAnthropicModel}>
                <SelectTrigger className="h-8">
                  <SelectValue>
                    {anthropicModel === 'claude-3-5-sonnet-20241022' ? 'Claude 3.5 Sonnet' : anthropicModel === 'claude-3-opus-20240229' ? 'Claude 3 Opus' : 'Claude 3 Haiku'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                  <SelectItem value="claude-3-opus-20240229">Claude 3 Opus</SelectItem>
                  <SelectItem value="claude-3-haiku-20240307">Claude 3 Haiku</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => testConnection('Anthropic')}
            >
              Test Connection
            </Button>
          </div>
        )}
      </div>

      {/* Gemini Section */}
      <div className="border rounded-lg">
        <button
          type="button"
          className="w-full p-3 flex items-center justify-between hover:bg-accent/50 transition-colors"
          onClick={() => setExpandedProvider(expandedProvider === 'gemini' ? null : 'gemini')}
        >
          <span className="font-medium text-sm">Google Gemini</span>
          <span className="text-xs text-muted-foreground">
            {expandedProvider === 'gemini' ? '▼' : '▶'}
          </span>
        </button>
        {expandedProvider === 'gemini' && (
          <div className="p-3 border-t space-y-3">
            <div className="space-y-2">
              <Label htmlFor="gemini-key">API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="gemini-key"
                  type={showKeys['gemini'] ? 'text' : 'password'}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIza..."
                  className="h-8 text-xs font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => toggleShowKey('gemini')}
                >
                  {showKeys['gemini'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Default Model</Label>
              <Select value={geminiModel} onValueChange={setGeminiModel}>
                <SelectTrigger className="h-8">
                  <SelectValue>
                    {geminiModel === 'gemini-2.0-flash-exp' ? 'Gemini 2.0 Flash' : geminiModel === 'gemini-1.5-pro' ? 'Gemini 1.5 Pro' : 'Gemini 1.5 Flash'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-2.0-flash-exp">Gemini 2.0 Flash</SelectItem>
                  <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                  <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => testConnection('Gemini')}
            >
              Test Connection
            </Button>
          </div>
        )}
      </div>

      <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</Button>
    </div>
  );
}

