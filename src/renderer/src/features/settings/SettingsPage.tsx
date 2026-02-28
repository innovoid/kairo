import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/stores/settings-store';
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
import {
  Monitor,
  Palette,
  Bot,
  User,
  Keyboard,
  Eye,
  EyeOff,
  Check,
} from 'lucide-react';
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

const NAV_ITEMS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: 'terminal', label: 'Terminal', icon: Monitor },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'ai', label: 'AI', icon: Bot },
  { id: 'account', label: 'Account', icon: User },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
];

export function SettingsPage({ activeTab, onTabChange, workspaceId }: SettingsPageProps) {
  const { fetchSettings } = useSettingsStore();

  // Fetch settings once when the settings page opens
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);
  return (
    <div className="flex h-full overflow-hidden">
      {/* Left nav */}
      <nav className="w-52 shrink-0 border-r border-[var(--border-subtle)] bg-[var(--surface-1)]/50 py-3 px-2 flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-all duration-150',
              activeTab === id
                ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                : 'text-[var(--text-secondary)] hover:text-foreground hover:bg-[var(--surface-2)]'
            )}
          >
            <Icon className={cn('h-4 w-4 shrink-0', activeTab === id ? 'text-emerald-400' : '')} />
            {label}
          </button>
        ))}
      </nav>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {activeTab === 'terminal' && <TerminalTab />}
        {activeTab === 'appearance' && <AppearanceTab />}
        {activeTab === 'ai' && <AiTab />}
        {activeTab === 'account' && <AccountSettingsTab />}
        {activeTab === 'shortcuts' && <ShortcutsSettingsTab />}
      </div>
    </div>
  );
}

// ─── Shared UI ─────────────────────────────────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{description}</p>
      )}
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
  inline = false,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  inline?: boolean;
}) {
  return (
    <div className={cn('flex gap-4', inline ? 'items-center justify-between' : 'flex-col gap-1.5')}>
      <div className={inline ? 'flex-1' : ''}>
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        {description && (
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{description}</p>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

// ─── Terminal Tab ─────────────────────────────────────────────────────────────

function TerminalTab() {
  const { settings, updateSettings } = useSettingsStore();
  const [terminalFont, setTerminalFont] = useState('JetBrains Mono');
  const [terminalFontSize, setTerminalFontSize] = useState('13');
  const [terminalTheme, setTerminalTheme] = useState<TerminalTheme>('dracula');
  const [promptStyle, setPromptStyle] = useState<'default' | 'minimal' | 'directory'>('default');
  const [scrollback, setScrollback] = useState('10000');
  const [cursorStyle, setCursorStyle] = useState<CursorStyle>('block');
  const [bellStyle, setBellStyle] = useState<BellStyle>('none');
  const [lineHeight, setLineHeight] = useState('1.0');
  const [copyOnSelect, setCopyOnSelect] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setTerminalFont(settings.terminalFont);
      setTerminalFontSize(String(settings.terminalFontSize));
      setTerminalTheme(settings.terminalTheme ?? 'dracula');
      setPromptStyle(settings.promptStyle ?? 'default');
      setScrollback(String(settings.scrollbackLines ?? 10000));
      setCursorStyle(settings.cursorStyle ?? 'block');
      setBellStyle(settings.bellStyle ?? 'none');
      setLineHeight(String(settings.lineHeight ?? 1.0));
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
      toast.success('Terminal settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Font */}
      <div>
        <SectionHeader title="Font" />
        <div className="space-y-4">
          <SettingRow label="Font Family" description="Bundled fonts work without installation">
            <Select value={terminalFont} onValueChange={(v) => { if (v) setTerminalFont(v); }}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Source Code Pro'].map((f) => (
                  <SelectItem key={f} value={f}>
                    <div className="flex items-center gap-2">
                      <span>{f}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Bundled</Badge>
                    </div>
                  </SelectItem>
                ))}
                {['Menlo', 'Monaco', 'SF Mono'].map((f) => (
                  <SelectItem key={f} value={f}>{f} (System)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
          <SettingRow label="Font Size">
            <Input
              type="number"
              value={terminalFontSize}
              onChange={(e) => setTerminalFontSize(e.target.value)}
              min={8}
              max={32}
              className="w-20"
            />
          </SettingRow>
          <SettingRow label="Line Height">
            <div className="flex items-center gap-3 w-56">
              <input
                type="range"
                min="1.0"
                max="2.0"
                step="0.1"
                value={lineHeight}
                onChange={(e) => setLineHeight(e.target.value)}
                className="flex-1 accent-emerald-500"
              />
              <span className="text-sm tabular-nums w-8 text-right text-[var(--text-secondary)]">
                {lineHeight}
              </span>
            </div>
          </SettingRow>
        </div>
      </div>

      <Separator />

      {/* Cursor */}
      <div>
        <SectionHeader title="Cursor" />
        <div className="space-y-4">
          <SettingRow label="Cursor Style">
            <div className="flex gap-2">
              {(['block', 'underline', 'bar'] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setCursorStyle(style)}
                  className={cn(
                    'w-20 h-16 rounded-md border-2 flex flex-col items-center justify-center gap-1.5 transition-all duration-200',
                    cursorStyle === style
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-foreground'
                  )}
                >
                  <span className="font-mono text-xl leading-none">
                    {style === 'block' && '█'}
                    {style === 'underline' && '_'}
                    {style === 'bar' && '|'}
                  </span>
                  <span className="text-[11px] capitalize">{style}</span>
                </button>
              ))}
            </div>
          </SettingRow>
        </div>
      </div>

      <Separator />

      {/* Theme */}
      <div>
        <SectionHeader title="Color Theme" description="Choose a color scheme for your terminal" />
        <div className="grid grid-cols-2 gap-3">
          {TERMINAL_THEME_NAMES.map((name) => {
            const themeConfig = TERMINAL_THEMES[name];
            const theme = themeConfig.theme;
            const isActive = terminalTheme === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setTerminalTheme(name as TerminalTheme)}
                className={cn(
                  'relative rounded-lg border-2 p-3 text-left transition-all duration-200',
                  isActive
                    ? 'border-emerald-500 bg-emerald-500/5'
                    : 'border-[var(--border)] hover:border-[var(--border-hover)]'
                )}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{themeConfig.name}</span>
                    {isActive && (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                        <Check className="h-3 w-3" />
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--text-secondary)] line-clamp-1">{themeConfig.description}</p>
                  <div
                    className="h-14 rounded border overflow-hidden font-mono text-[10px] p-2 leading-tight"
                    style={{ backgroundColor: theme.background as string, color: theme.foreground as string }}
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

      <Separator />

      {/* Behavior */}
      <div>
        <SectionHeader title="Behavior" />
        <div className="space-y-4">
          <SettingRow label="Prompt Style" description="How your terminal prompt appears">
            <div className="flex gap-2">
              {([
                { value: 'default', label: 'Default', example: 'user@host ~ %' },
                { value: 'minimal', label: 'Minimal', example: '$' },
                { value: 'directory', label: 'Directory', example: '~ $' },
              ] as const).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPromptStyle(value)}
                  className={cn(
                    'px-4 py-2 border rounded-md text-sm transition-all duration-200',
                    promptStyle === value
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-foreground hover:bg-[var(--surface-1)]'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </SettingRow>
          <SettingRow label="Scrollback Lines">
            <Input
              type="number"
              value={scrollback}
              onChange={(e) => setScrollback(e.target.value)}
              min={500}
              max={100000}
              className="w-28"
            />
          </SettingRow>
          <SettingRow label="Bell">
            <Select value={bellStyle} onValueChange={(v) => setBellStyle(v as BellStyle)}>
              <SelectTrigger className="w-48">
                <SelectValue>
                  {bellStyle === 'none' ? 'None (silent)' : bellStyle === 'sound' ? 'Sound (beep)' : 'Visual (flash)'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (silent)</SelectItem>
                <SelectItem value="sound">Sound (system beep)</SelectItem>
                <SelectItem value="visual">Visual (flash)</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
          <SettingRow label="Copy on select" description="Automatically copy selected text to clipboard" inline>
            <Switch checked={copyOnSelect} onCheckedChange={setCopyOnSelect} />
          </SettingRow>
        </div>
      </div>

      <div className="pt-2">
        <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white">
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}

// ─── Appearance Tab ───────────────────────────────────────────────────────────

function AppearanceTab() {
  const { settings, updateSettings } = useSettingsStore();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (settings) setTheme(settings.theme); }, [settings]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateSettings({ theme });
      toast.success('Appearance saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md space-y-6">
      <SectionHeader title="Appearance" description="Color theme and visual preferences" />
      <div className="space-y-4">
        <SettingRow label="App Theme">
          <div className="flex gap-3">
            {(['dark', 'light'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={cn(
                  'w-28 h-20 rounded-lg border-2 flex flex-col items-center justify-center gap-2 transition-all duration-200',
                  theme === t
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-[var(--border)] hover:border-[var(--border-hover)]'
                )}
              >
                <div
                  className="w-12 h-8 rounded border"
                  style={{ background: t === 'dark' ? '#1a1a1a' : '#f5f5f5', borderColor: t === 'dark' ? '#333' : '#ddd' }}
                />
                <span className={cn('text-sm capitalize', theme === t ? 'text-emerald-400 font-medium' : 'text-[var(--text-secondary)]')}>
                  {t}
                </span>
              </button>
            ))}
          </div>
        </SettingRow>
      </div>
      <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white">
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  );
}

// ─── AI Tab ───────────────────────────────────────────────────────────────────

const AI_PROVIDERS = [
  {
    id: 'gemini' as AiProvider,
    name: 'Google Gemini',
    description: 'Gemini 2.0 Flash · Fast, capable, generous free tier',
    placeholder: 'AIza...',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    badge: 'Default',
  },
  {
    id: 'openai' as AiProvider,
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4o mini · Industry-leading models',
    placeholder: 'sk-...',
    docsUrl: 'https://platform.openai.com/api-keys',
    badge: null,
  },
  {
    id: 'anthropic' as AiProvider,
    name: 'Anthropic',
    description: 'Claude Sonnet, Haiku · Excellent at reasoning',
    placeholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    badge: null,
  },
] as const;

function AiTab() {
  const { settings, updateSettings } = useSettingsStore();
  const [aiProvider, setAiProvider] = useState<AiProvider>('gemini');
  const [keys, setKeys] = useState<Record<string, string>>({ openai: '', anthropic: '', gemini: '' });
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      window.apiKeysApi.get('openai'),
      window.apiKeysApi.get('anthropic'),
      window.apiKeysApi.get('gemini'),
    ]).then(([oai, anth, gem]) => {
      setKeys({ openai: oai || '', anthropic: anth || '', gemini: gem || '' });
    }).catch(() => {
      toast.error('Failed to load API keys');
    });
  }, []);

  useEffect(() => {
    if (settings) setAiProvider(settings.aiProvider);
  }, [settings]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateSettings({ aiProvider });
      for (const provider of ['openai', 'anthropic', 'gemini'] as const) {
        if (keys[provider]) {
          await window.apiKeysApi.set(provider, keys[provider]);
        } else {
          await window.apiKeysApi.delete(provider);
        }
      }
      toast.success('AI settings saved');
    } catch {
      toast.error('Failed to save AI settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <SectionHeader
        title="AI Providers"
        description="Choose your active provider and enter API keys. Keys are stored encrypted on-device."
      />

      <div className="space-y-3">
        {AI_PROVIDERS.map((p) => {
          const isActive = aiProvider === p.id;
          const hasKey = !!keys[p.id];
          return (
            <div
              key={p.id}
              className={cn(
                'rounded-xl border-2 transition-all duration-200',
                isActive
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : 'border-[var(--border)] hover:border-[var(--border-hover)]'
              )}
            >
              {/* Provider header */}
              <button
                type="button"
                onClick={() => setAiProvider(p.id)}
                className="w-full px-4 py-3 flex items-start gap-3 text-left"
              >
                {/* Radio indicator */}
                <div className={cn(
                  'mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors',
                  isActive ? 'border-emerald-500 bg-emerald-500' : 'border-[var(--border)]'
                )}>
                  {isActive && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{p.name}</span>
                    {p.badge && (
                      <Badge className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/20 text-emerald-400 border-0">
                        {p.badge}
                      </Badge>
                    )}
                    {hasKey && (
                      <Badge className="text-[10px] px-1.5 py-0 h-4 bg-[var(--surface-3)] text-[var(--text-secondary)] border-0">
                        Key saved
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{p.description}</p>
                </div>
              </button>

              {/* API key input */}
              <div className="px-4 pb-3 border-t border-[var(--border-subtle)]">
                <div className="flex gap-2 mt-3">
                  <Input
                    type={showKeys[p.id] ? 'text' : 'password'}
                    value={keys[p.id]}
                    onChange={(e) => setKeys((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    placeholder={p.placeholder}
                    className="h-8 text-xs font-mono flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setShowKeys((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                  >
                    {showKeys[p.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white">
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  );
}
