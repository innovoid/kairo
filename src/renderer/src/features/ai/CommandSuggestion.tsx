import { useState } from 'react';
import { useAiStore } from '@/stores/ai-store';
import { useSessionStore } from '@/stores/session-store';
import { useSettingsStore } from '@/stores/settings-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function CommandSuggestion() {
  const [input, setInput] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(false);
  const { isStreaming } = useAiStore();
  const settings = useSettingsStore((s) => s.settings);

  async function handleTranslate() {
    if (!input.trim() || isStreaming || loading) return;

    // Get provider and API key from settings
    const provider = settings?.aiProvider ?? 'openai';
    const apiKey =
      provider === 'openai' ? settings?.openaiApiKeyEncrypted :
      provider === 'anthropic' ? settings?.anthropicApiKeyEncrypted :
      provider === 'gemini' ? settings?.geminiApiKeyEncrypted :
      null;

    if (!apiKey) {
      toast.error(`No API key configured for ${provider}. Go to Settings → AI to add your key.`);
      return;
    }

    setLoading(true);
    setSuggestion('');

    const requestId = crypto.randomUUID();
    let result = '';

    // Listen for chunks
    const offChunk = window.aiApi.onChunk((id, chunk) => {
      if (id === requestId) {
        result += chunk;
        setSuggestion(result);
      }
    });

    const offDone = window.aiApi.onDone((id) => {
      if (id === requestId) {
        setLoading(false);
        offChunk();
        offDone();
        offError();
      }
    });

    const offError = window.aiApi.onError((id, error) => {
      if (id === requestId) {
        toast.error(error);
        setLoading(false);
        offChunk();
        offDone();
        offError();
      }
    });

    try {
      // Use the model from settings or default to mini version
      const model =
        provider === 'openai' ? 'gpt-4o-mini' :
        provider === 'anthropic' ? 'claude-haiku-3-5' :
        'gemini-2.0-flash';

      await window.aiApi.translateCommand({
        provider,
        apiKey,
        model,
        naturalLanguage: input,
        requestId,
      });
    } catch (error) {
      toast.error('Failed to translate command');
      setLoading(false);
      offChunk();
      offDone();
      offError();
    }
  }

  function handleInsert() {
    const activeTab = useSessionStore.getState().tabs.get(
      useSessionStore.getState().activeTabId ?? ''
    );

    if (!activeTab || activeTab.tabType !== 'terminal') {
      toast.error('Open a terminal first');
      return;
    }

    if (!activeTab.sessionId) {
      toast.error('No active terminal session');
      return;
    }

    // Remove leading $ or whitespace if present
    const sanitized = suggestion.replace(/^\$?\s*/, '').trim();
    window.sshApi.send(activeTab.sessionId, sanitized);
    toast.success('Command inserted');

    // Clear form
    setInput('');
    setSuggestion('');
  }

  return (
    <div className="p-3 border-b space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Quick Command</p>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="What do you want to do?"
        className="text-xs h-8"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleTranslate();
          }
        }}
      />
      <Button
        size="sm"
        className="w-full h-7 text-xs"
        onClick={handleTranslate}
        disabled={!input.trim() || loading || isStreaming}
      >
        {loading ? (
          <>
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Translating...
          </>
        ) : (
          'Translate'
        )}
      </Button>

      {suggestion && (
        <div className="space-y-2 p-2 bg-muted rounded">
          <code className="block text-xs font-mono bg-background px-2 py-1 rounded break-all">
            {suggestion}
          </code>
          <Button
            size="sm"
            className="w-full h-7 text-xs"
            onClick={handleInsert}
          >
            <ArrowRight className="h-3 w-3 mr-1" />
            Insert into Terminal
          </Button>
        </div>
      )}
    </div>
  );
}
