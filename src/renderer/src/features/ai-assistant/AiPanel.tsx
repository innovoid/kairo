import { useEffect, useRef, useState } from 'react';
import { useAiStore, MODELS_BY_PROVIDER } from '@/stores/ai-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useSessionStore } from '@/stores/session-store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, ChevronDown, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ChatMessage } from './ChatMessage';
import { resolveActiveTerminalSessionId, sanitizeCommandForInsert } from './command-insert';

interface AiPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true, hides the panel header (for embedding inside another panel) */
  hideHeader?: boolean;
}

export function AiPanel({ open, onOpenChange, hideHeader = false }: AiPanelProps) {
  const { messages, isStreaming, model, setModel, sendMessage, clearHistory, initListeners } = useAiStore();
  const settings = useSettingsStore((s) => s.settings);
  const tabs = useSessionStore((s) => s.tabs);
  const activeTabId = useSessionStore((s) => s.activeTabId);
  const [input, setInput] = useState('');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const provider = settings?.aiProvider ?? 'gemini';
  const models = MODELS_BY_PROVIDER[provider] ?? MODELS_BY_PROVIDER.gemini;
  const currentModelLabel = models.find((m) => m.value === model)?.label ?? model;

  // Wire up AI stream events at store level (once, not tied to component lifecycle)
  useEffect(() => { initListeners(); }, [initListeners]);

  // Sync model to provider default when provider changes
  useEffect(() => {
    if (provider && models.length > 0) {
      const currentValid = models.some((m) => m.value === model);
      if (!currentValid) setModel(models[0].value);
    }
  }, [provider]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    await sendMessage(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function handleInsertCommand(command: string) {
    const sid = resolveActiveTerminalSessionId(tabs, activeTabId);
    if (!sid) {
      toast.error('Open a terminal tab first to insert commands');
      return;
    }
    void window.sshApi.send(sid, sanitizeCommandForInsert(command) + '\n');
    toast.success('Command inserted');
  }

  if (!open) return null;

  return (
    <div className="flex flex-col h-full w-full bg-background">
      {/* Header — hidden when embedded inside another panel */}
      {!hideHeader && (
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/70 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-md bg-primary/10 border border-primary/20">
            <Bot className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-xs font-semibold text-foreground tracking-tight">AI Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearHistory}
              title="Clear history"
              className="h-5 w-5 flex items-center justify-center rounded text-text-disabled hover:text-text-secondary hover:bg-surface-3 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-5 w-5 flex items-center justify-center rounded text-text-disabled hover:text-text-secondary hover:bg-surface-3 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
      )}

      {/* Model selector */}
      <div className="relative px-3 py-1.5 border-b border-border/70 shrink-0">
        <button
          type="button"
          onClick={() => setModelMenuOpen((v) => !v)}
          className="flex items-center gap-1.5 text-[10px] text-text-tertiary hover:text-text-secondary transition-colors"
        >
          <Sparkles className="h-3 w-3 text-primary/70" />
          <span className="font-mono">{currentModelLabel}</span>
          <ChevronDown className={cn('h-2.5 w-2.5 transition-transform', modelMenuOpen && 'rotate-180')} />
        </button>
        {modelMenuOpen && (
          <div className="absolute left-2 top-full mt-1 z-50 bg-surface-1 border border-border rounded-lg shadow-xl py-1 min-w-[160px]">
            {models.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => { setModel(m.value); setModelMenuOpen(false); }}
                className={cn(
                  'w-full text-left px-3 py-1.5 text-[11px] font-mono transition-colors',
                  model === m.value
                    ? 'text-primary bg-primary/10'
                    : 'text-text-secondary hover:text-foreground hover:bg-surface-3',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 gap-3 px-4 text-center">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary/60" />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-text-secondary">Terminal AI Assistant</p>
              <p className="text-[10px] text-text-disabled leading-relaxed max-w-[180px]">
                Ask anything about shell commands, SSH, system administration, or troubleshooting.
              </p>
            </div>
            <div className="space-y-1 text-left w-full max-w-[200px]">
              {[
                'How do I find files larger than 1GB?',
                'Explain this: awk \'{print $2}\'',
                'Set up SSH key forwarding',
              ].map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => { setInput(ex); inputRef.current?.focus(); }}
                  className="w-full text-left px-2.5 py-1.5 text-[10px] text-text-tertiary hover:text-text-secondary border border-border/60 hover:border-border rounded-md transition-colors font-mono leading-relaxed"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {messages.filter((m) => m.role !== 'system').map((msg) => (
              <ChatMessage
                key={msg.id}
                role={msg.role === 'system' ? 'assistant' : msg.role as 'user' | 'assistant'}
                content={msg.content}
                timestamp={msg.createdAt}
                error={msg.error}
                onInsertCommand={handleInsertCommand}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-border/70 space-y-2 shrink-0">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
            rows={2}
            disabled={isStreaming}
            className={cn(
              'w-full resize-none rounded-lg px-2.5 py-2 pr-8 text-xs font-mono',
              'bg-black/40 border border-border text-foreground',
              'placeholder:text-border focus:outline-none focus:border-primary/40',
              'transition-colors disabled:opacity-40',
            )}
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!input.trim() || isStreaming}
            className={cn(
              'absolute right-2 bottom-2 h-5 w-5 flex items-center justify-center rounded transition-colors',
              input.trim() && !isStreaming
                ? 'text-primary hover:text-primary-hover'
                : 'text-border',
            )}
          >
            <Send className="h-3 w-3" />
          </button>
        </div>
        {isStreaming && (
          <div className="flex items-center gap-1.5 text-[10px] text-text-disabled">
            <span className="inline-flex gap-0.5">
              <span className="h-1 w-1 bg-primary rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="h-1 w-1 bg-primary rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="h-1 w-1 bg-primary rounded-full animate-bounce [animation-delay:300ms]" />
            </span>
            Thinking…
          </div>
        )}
      </div>
    </div>
  );
}
