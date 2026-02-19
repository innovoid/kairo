import { useEffect, useRef, useState } from 'react';
import { useAiStore } from '@/stores/ai-store';
import { ChatMessage } from './ChatMessage';
import { ModelSelector } from './ProviderSelector';
import { CommandSuggestion } from './CommandSuggestion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Send, Trash2, Bot } from 'lucide-react';

export function AiPanel() {
  const { messages, isStreaming, isOpen, setOpen, sendMessage, appendChunk, finishStreaming, clearHistory } = useAiStore();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Wire up AI stream events
  useEffect(() => {
    const offChunk = window.aiApi.onChunk((requestId, chunk) => {
      appendChunk(requestId, chunk);
    });
    const offDone = window.aiApi.onDone((requestId) => {
      finishStreaming(requestId);
    });
    const offError = window.aiApi.onError((requestId, error) => {
      appendChunk(requestId, `\n[Error: ${error}]`);
      finishStreaming(requestId);
    });
    return () => { offChunk(); offDone(); offError(); };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    await sendMessage(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="fixed bottom-8 right-4 h-9 w-9 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
        onClick={() => setOpen(true)}
        title="Open AI Assistant"
      >
        <Bot className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="flex flex-col w-72 border-l bg-background shrink-0">
      {/* Header */}
      <div className="flex items-center px-3 h-9 border-b shrink-0">
        <Bot className="h-4 w-4 mr-2 text-primary" />
        <span className="text-sm font-medium flex-1">AI Assistant</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Model selector */}
      <ModelSelector />

      {/* Quick Command */}
      <CommandSuggestion />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Ask anything about Linux commands, shell scripting, or troubleshooting.
          </p>
        ) : (
          messages.map((m) => <ChatMessage key={m.id} message={m} />)
        )}
      </div>

      {/* Input */}
      <div className="p-2 border-t space-y-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything... (Enter to send)"
          className="text-xs min-h-16 resize-none"
          disabled={isStreaming}
        />
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={clearHistory}
            title="Clear history"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
          >
            <Send className="h-3.5 w-3.5 mr-1" />
            {isStreaming ? 'Thinking...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}
