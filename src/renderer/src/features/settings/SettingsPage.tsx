import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/stores/settings-store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
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
import { ShortcutsSettingsTab } from './ShortcutsSettingsTab';

export type SettingsTab = 'terminal' | 'appearance' | 'ai' | 'account' | 'shortcuts';

interface SettingsPageProps {
  activeTab: SettingsTab;
  onTabChange: (tab: string) => void;
  workspaceId: string;
}

export function SettingsPage({ activeTab, onTabChange, workspaceId }: SettingsPageProps) {
  return (
    <div className="flex flex-col flex-1 h-full bg-background overflow-hidden">
      <div className="py-6 px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-display mb-2">Settings</h1>
          <p className="text-body text-[var(--text-secondary)]">Configure your terminal preferences</p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={onTabChange} className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="w-fit bg-transparent p-0 gap-1 mb-8 h-auto border-b border-[var(--border-subtle)]">
            <TabsTrigger
              value="terminal"
              className={cn(
                "px-4 py-2 text-sm rounded-t-md border-b-2 transition-all duration-300",
                "data-[state=active]:border-[var(--primary)] data-[state=active]:text-[var(--primary)] data-[state=active]:bg-[var(--surface-2)]",
                "data-[state=inactive]:border-transparent data-[state=inactive]:text-[var(--text-secondary)] data-[state=inactive]:hover:text-foreground"
              )}
            >
              Terminal
            </TabsTrigger>
            <TabsTrigger
              value="appearance"
              className={cn(
                "px-4 py-2 text-sm rounded-t-md border-b-2 transition-all duration-300",
                "data-[state=active]:border-[var(--primary)] data-[state=active]:text-[var(--primary)] data-[state=active]:bg-[var(--surface-2)]",
                "data-[state=inactive]:border-transparent data-[state=inactive]:text-[var(--text-secondary)] data-[state=inactive]:hover:text-foreground"
              )}
            >
              Theme
            </TabsTrigger>
            <TabsTrigger
              value="ai"
              className={cn(
                "px-4 py-2 text-sm rounded-t-md border-b-2 transition-all duration-300",
                "data-[state=active]:border-[var(--primary)] data-[state=active]:text-[var(--primary)] data-[state=active]:bg-[var(--surface-2)]",
                "data-[state=inactive]:border-transparent data-[state=inactive]:text-[var(--text-secondary)] data-[state=inactive]:hover:text-foreground"
              )}
            >
              AI
            </TabsTrigger>
            <TabsTrigger
              value="account"
              className={cn(
                "px-4 py-2 text-sm rounded-t-md border-b-2 transition-all duration-300",
                "data-[state=active]:border-[var(--primary)] data-[state=active]:text-[var(--primary)] data-[state=active]:bg-[var(--surface-2)]",
                "data-[state=inactive]:border-transparent data-[state=inactive]:text-[var(--text-secondary)] data-[state=inactive]:hover:text-foreground"
              )}
            >
              Account
            </TabsTrigger>
            <TabsTrigger
              value="shortcuts"
              className={cn(
                "px-4 py-2 text-sm rounded-t-md border-b-2 transition-all duration-300",
                "data-[state=active]:border-[var(--primary)] data-[state=active]:text-[var(--primary)] data-[state=active]:bg-[var(--surface-2)]",
                "data-[state=inactive]:border-transparent data-[state=inactive]:text-[var(--text-secondary)] data-[state=inactive]:hover:text-foreground"
              )}
            >
              Shortcuts
            </TabsTrigger>
          </TabsList>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            <TabsContent value="terminal" className="mt-0">
              <TerminalTab />
            </TabsContent>
            <TabsContent value="appearance" className="mt-0">
              <AppearanceTab />
            </TabsContent>
            <TabsContent value="ai" className="mt-0">
              <AiTab />
            </TabsContent>
            <TabsContent value="account" className="mt-0">
              <AccountSettingsTab />
            </TabsContent>
            <TabsContent value="shortcuts" className="mt-0">
              <ShortcutsSettingsTab />
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
  const [terminalFontSize, setTerminalFontSize] = useState('13');
  const [terminalTheme, setTerminalTheme] = useState<TerminalTheme>('dracula');
  const [promptStyle, setPromptStyle] = useState<'default' | 'minimal' | 'directory'>('default');
  const [scrollback, setScrollback] = useState('1000');
  const [cursorStyle, setCursorStyle] = useState<CursorStyle>('bar');
  const [bellStyle, setBellStyle] = useState<BellStyle>('none');
  const [lineHeight, setLineHeight] = useState('1.2');
  const [copyOnSelect, setCopyOnSelect] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (settings) {
      setTerminalFont(settings.terminalFont);
      setTerminalFontSize(String(settings.terminalFontSize));
      setTerminalTheme(settings.terminalTheme ?? 'dracula');
      setPromptStyle(settings.promptStyle ?? 'default');
      setScrollback(String(settings.scrollbackLines ?? 1000));
      setCursorStyle(settings.cursorStyle ?? 'bar');
      setBellStyle(settings.bellStyle ?? 'none');
      setLineHeight(String(settings.lineHeight ?? 1.2));
      setCopyOnSelect(settings.copyOnSelect ?? false);
    }
  }, [settings]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateSettings({
        terminalFont,
        terminalFontSize: parseInt(terminalFontSize),
        terminalTheme,
        promptStyle,
        scrollbackLines: parseInt(scrollback),
        cursorStyle,
        bellStyle,
        lineHeight: parseFloat(lineHeight),
        copyOnSelect,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Separator />
      <div className="space-y-6">
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">Font Family</Label>
            <p className="text-small text-[var(--text-secondary)] mt-1">Bundled fonts work without installation</p>
          </div>
          <Select value={terminalFont} onValueChange={(v) => { if (v) setTerminalFont(v); }}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="JetBrains Mono">
                <div className="flex items-center gap-2">
                  <span>JetBrains Mono</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Bundled</Badge>
                </div>
              </SelectItem>
              <SelectItem value="Fira Code">
                <div className="flex items-center gap-2">
                  <span>Fira Code</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Bundled</Badge>
                </div>
              </SelectItem>
              <SelectItem value="Cascadia Code">
                <div className="flex items-center gap-2">
                  <span>Cascadia Code</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Bundled</Badge>
                </div>
              </SelectItem>
              <SelectItem value="Source Code Pro">
                <div className="flex items-center gap-2">
                  <span>Source Code Pro</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Bundled</Badge>
                </div>
              </SelectItem>
              <SelectItem value="Menlo">Menlo (System)</SelectItem>
              <SelectItem value="Monaco">Monaco (System)</SelectItem>
              <SelectItem value="SF Mono">SF Mono (System)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">Font Size</Label>
          </div>
          <Input type="number" value={terminalFontSize} onChange={(e) => setTerminalFontSize(e.target.value)} min={8} max={32} className="w-24" />
        </div>
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">Color Theme</Label>
            <p className="text-small text-[var(--text-secondary)] mt-1">Choose a color scheme for your terminal</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {TERMINAL_THEME_NAMES.map((name) => {
              const themeConfig = TERMINAL_THEMES[name];
              const theme = themeConfig.theme;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setTerminalTheme(name as TerminalTheme)}
                  className={cn(
                    'relative rounded-lg border-2 p-3 text-left transition-all duration-300 hover:scale-[1.02]',
                    terminalTheme === name
                      ? 'border-[var(--primary)] bg-[var(--surface-2)]'
                      : 'border-[var(--border)] hover:border-[var(--border-hover)]'
                  )}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{themeConfig.name}</span>
                      {terminalTheme === name && (
                        <Badge variant="default" className="h-4 px-1.5 text-[10px] bg-[var(--primary)] text-white">Active</Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] line-clamp-1">{themeConfig.description}</p>
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
        <div className="space-y-3">
          <div>
            <Label htmlFor="line-height" className="text-sm font-medium">Line Height</Label>
          </div>
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
            <span className="text-sm text-[var(--text-secondary)] w-12 text-right">
              {lineHeight}
            </span>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <Label htmlFor="scrollback" className="text-sm font-medium">Scrollback Lines</Label>
          </div>
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
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">Cursor Style</Label>
          </div>
          <div className="flex gap-2">
            {(['block', 'underline', 'bar'] as const).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => setCursorStyle(style)}
                className={cn(
                  'flex-1 h-20 rounded-md border-2 flex flex-col items-center justify-center gap-2 transition-all duration-300',
                  cursorStyle === style
                    ? 'border-[var(--primary)] bg-[var(--surface-2)] text-[var(--primary)]'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-foreground'
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
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">Prompt Style</Label>
            <p className="text-sm text-muted-foreground mt-1">Choose how your terminal prompt appears</p>
          </div>
          <div className="flex gap-3">
            {([
              { value: 'default', label: 'Default', example: 'user@host ~ %' },
              { value: 'minimal', label: 'Minimal', example: '$' },
              { value: 'directory', label: 'Directory', example: '~ $' }
            ] as const).map(({ value, label, example }) => (
              <button
                key={value}
                type="button"
                onClick={() => setPromptStyle(value)}
                className={cn(
                  'px-5 py-3 border rounded-md transition-all duration-300',
                  promptStyle === value
                    ? 'border-[var(--primary)] bg-[var(--surface-2)] text-[var(--primary)]'
                    : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-foreground hover:bg-[var(--surface-1)]'
                )}
              >
                <span className="text-sm">{label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <Label htmlFor="bell-style" className="text-sm font-medium">Bell</Label>
          </div>
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
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="copy-on-select" className="text-sm font-medium">Copy on select</Label>
              <p className="text-small text-[var(--text-secondary)]">Automatically copy selected text to clipboard</p>
            </div>
            <Switch
              id="copy-on-select"
              checked={copyOnSelect}
              onCheckedChange={setCopyOnSelect}
            />
          </div>
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
        <p className="text-small text-[var(--text-secondary)]">Color theme and visual preferences.</p>
      </div>
      <Separator />
      <div className="space-y-6">
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">Theme</Label>
          </div>
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
    // Load API keys from local encrypted storage
    Promise.all([
      window.apiKeysApi.get('openai'),
      window.apiKeysApi.get('anthropic'),
      window.apiKeysApi.get('gemini'),
    ]).then(([oai, anth, gem]) => {
      setOpenaiKey(oai || '');
      setAnthropicKey(anth || '');
      setGeminiKey(gem || '');
    }).catch(() => {
      toast.error('Failed to load API keys');
    });
  }, []);

  useEffect(() => {
    if (settings) {
      setAiProvider(settings.aiProvider);
    }
  }, [settings]);

  async function handleSave() {
    setSaving(true);
    try {
      // Save provider preference to Supabase via settings
      await updateSettings({ aiProvider });

      // Save API keys to local encrypted storage
      if (openaiKey) {
        await window.apiKeysApi.set('openai', openaiKey);
      } else {
        await window.apiKeysApi.delete('openai');
      }
      if (anthropicKey) {
        await window.apiKeysApi.set('anthropic', anthropicKey);
      } else {
        await window.apiKeysApi.delete('anthropic');
      }
      if (geminiKey) {
        await window.apiKeysApi.set('gemini', geminiKey);
      } else {
        await window.apiKeysApi.delete('gemini');
      }

      toast.success('AI settings saved successfully');
    } catch (e) {
      toast.error('Failed to save AI settings');
    } finally {
      setSaving(false);
    }
  }

  function toggleShowKey(provider: string) {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1">AI Providers</h2>
        <p className="text-small text-[var(--text-secondary)]">Configure API keys for AI assistants.</p>
      </div>
      <Separator />

      {/* Active provider selector */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-medium">Active AI Provider</Label>
          <p className="text-small text-[var(--text-secondary)] mt-1">The AI provider used in the AI assistant.</p>
        </div>
        <Select value={aiProvider} onValueChange={(v) => setAiProvider(v as AiProvider)}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="openai">OpenAI</SelectItem>
            <SelectItem value="anthropic">Anthropic</SelectItem>
            <SelectItem value="gemini">Google Gemini</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* OpenAI Section */}
      <div className="border border-[var(--border)] rounded-lg transition-all duration-300 hover:border-[var(--border-hover)]">
        <button
          type="button"
          className="w-full p-3 flex items-center justify-between hover:bg-[var(--surface-1)] transition-all duration-300 rounded-t-lg"
          onClick={() => setExpandedProvider(expandedProvider === 'openai' ? null : 'openai')}
        >
          <span className="font-medium text-sm">OpenAI</span>
          <span className="text-xs text-[var(--text-secondary)]">
            {expandedProvider === 'openai' ? '▼' : '▶'}
          </span>
        </button>
        {expandedProvider === 'openai' && (
          <div className="p-3 border-t border-[var(--border)] space-y-3">
            <div className="space-y-2">
              <Label htmlFor="openai-key" className="text-sm font-medium">API Key</Label>
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
          </div>
        )}
      </div>

      {/* Anthropic Section */}
      <div className="border border-[var(--border)] rounded-lg transition-all duration-300 hover:border-[var(--border-hover)]">
        <button
          type="button"
          className="w-full p-3 flex items-center justify-between hover:bg-[var(--surface-1)] transition-all duration-300 rounded-t-lg"
          onClick={() => setExpandedProvider(expandedProvider === 'anthropic' ? null : 'anthropic')}
        >
          <span className="font-medium text-sm">Anthropic</span>
          <span className="text-xs text-[var(--text-secondary)]">
            {expandedProvider === 'anthropic' ? '▼' : '▶'}
          </span>
        </button>
        {expandedProvider === 'anthropic' && (
          <div className="p-3 border-t border-[var(--border)] space-y-3">
            <div className="space-y-2">
              <Label htmlFor="anthropic-key" className="text-sm font-medium">API Key</Label>
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
          </div>
        )}
      </div>

      {/* Gemini Section */}
      <div className="border border-[var(--border)] rounded-lg transition-all duration-300 hover:border-[var(--border-hover)]">
        <button
          type="button"
          className="w-full p-3 flex items-center justify-between hover:bg-[var(--surface-1)] transition-all duration-300 rounded-t-lg"
          onClick={() => setExpandedProvider(expandedProvider === 'gemini' ? null : 'gemini')}
        >
          <span className="font-medium text-sm">Google Gemini</span>
          <span className="text-xs text-[var(--text-secondary)]">
            {expandedProvider === 'gemini' ? '▼' : '▶'}
          </span>
        </button>
        {expandedProvider === 'gemini' && (
          <div className="p-3 border-t border-[var(--border)] space-y-3">
            <div className="space-y-2">
              <Label htmlFor="gemini-key" className="text-sm font-medium">API Key</Label>
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
          </div>
        )}
      </div>

      <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</Button>
    </div>
  );
}
