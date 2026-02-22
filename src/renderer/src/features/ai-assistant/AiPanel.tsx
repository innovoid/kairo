import { useEffect, useRef, useState } from 'react';
import { useAiStore } from '@/stores/ai-store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ChatMessage } from './ChatMessage';

interface AiPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AiPanel({ open, onOpenChange }: AiPanelProps) {
  const { messages, isStreaming, sendMessage, clearHistory } = useAiStore();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Wire up AI stream events
  useEffect(() => {
    const { appendChunk, finishStreaming } = useAiStore.getState();

    const offChunk = window.aiApi?.onChunk((requestId, chunk) => {
      appendChunk(requestId, chunk);
    });
    const offDone = window.aiApi?.onDone((requestId) => {
      finishStreaming(requestId);
    });
    const offError = window.aiApi?.onError((requestId, error) => {
      appendChunk(requestId, `\n[Error: ${error}]`);
      finishStreaming(requestId);
    });

    return () => {
      offChunk?.();
      offDone?.();
      offError?.();
    };
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-96 flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            AI Assistant
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Messages */}
          <ScrollArea className="flex-1 mt-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground p-4">
                <div className="text-center">
                  <p className="mb-2">Ask me anything about your terminal or SSH connections</p>
                  <p className="text-xs">Try: "How do I list large files?" or "Explain this command"</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 p-4">
                {messages.map((msg, idx) => (
                  <ChatMessage
                    key={idx}
                    role={msg.role === 'system' ? 'assistant' : msg.role}
                    content={msg.content}
                    timestamp={msg.createdAt}
                    onInsertCommand={(cmd) => console.log('Insert command:', cmd)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t space-y-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything... (Enter to send)"
              className="text-sm min-h-20 resize-none"
              disabled={isStreaming}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearHistory}
                disabled={messages.length === 0}
                className="flex-1"
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                className="flex-1"
              >
                <Send className="h-4 w-4 mr-2" />
                {isStreaming ? 'Thinking...' : 'Send'}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
