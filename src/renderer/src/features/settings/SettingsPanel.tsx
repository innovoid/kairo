import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/stores/settings-store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X } from 'lucide-react';
import type { AiProvider } from '@shared/types/settings';

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { settings, fetchSettings, updateSettings } = useSettingsStore();
  const [terminalFont, setTerminalFont] = useState('JetBrains Mono');
  const [terminalFontSize, setTerminalFontSize] = useState('14');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [aiProvider, setAiProvider] = useState<AiProvider>('openai');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (settings) {
      setTerminalFont(settings.terminalFont);
      setTerminalFontSize(String(settings.terminalFontSize));
      setTheme(settings.theme);
      setAiProvider(settings.aiProvider);
    }
  }, [settings]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateSettings({
        terminalFont,
        terminalFontSize: parseInt(terminalFontSize),
        theme,
        aiProvider,
        openaiApiKey: openaiKey || undefined,
        anthropicApiKey: anthropicKey || undefined,
        geminiApiKey: geminiKey || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col w-80 border-l bg-background shrink-0">
      <div className="flex items-center px-3 h-9 border-b shrink-0">
        <span className="text-sm font-medium flex-1">Settings</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <Tabs defaultValue="terminal">
          <TabsList className="w-full">
            <TabsTrigger value="terminal" className="flex-1">Terminal</TabsTrigger>
            <TabsTrigger value="appearance" className="flex-1">Appearance</TabsTrigger>
            <TabsTrigger value="ai" className="flex-1">AI</TabsTrigger>
          </TabsList>

          <TabsContent value="terminal" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Font Family</Label>
              <Input
                value={terminalFont}
                onChange={(e) => setTerminalFont(e.target.value)}
                placeholder="JetBrains Mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Font Size</Label>
              <Input
                type="number"
                value={terminalFontSize}
                onChange={(e) => setTerminalFontSize(e.target.value)}
                min={8}
                max={32}
              />
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Theme</Label>
              <Select value={theme} onValueChange={(v) => { if (v) setTheme(v as 'dark' | 'light'); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="ai" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Default Provider</Label>
              <Select value={aiProvider} onValueChange={(v) => { if (v) setAiProvider(v as AiProvider); }}>
                <SelectTrigger>
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
              <Input type="password" value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} placeholder="sk-..." />
            </div>
            <div className="space-y-2">
              <Label>Anthropic API Key</Label>
              <Input type="password" value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)} placeholder="sk-ant-..." />
            </div>
            <div className="space-y-2">
              <Label>Gemini API Key</Label>
              <Input type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="AIza..." />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div className="flex gap-2 p-3 border-t shrink-0">
        <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
