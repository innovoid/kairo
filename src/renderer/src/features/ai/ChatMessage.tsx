import type { AiMessage } from '@shared/types/ai';
import { cn } from '@/lib/utils';
import { useSessionStore } from '@/stores/session-store';
import { Button } from '@/components/ui/button';
import { Terminal } from 'lucide-react';

interface ChatMessageProps {
  message: AiMessage;
}

// Simple inline code block extractor for command suggestions
function extractCommand(content: string): string | null {
  const match = content.match(/^[`]?([^`\n]+)[`]?$/);
  if (match && !content.includes(' ') || content.match(/^[\w./-]+(\s+[\w./-]+)*$/)) {
    return content.trim();
  }
  return null;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const { sessions, activeSessionId } = useSessionStore();

  function insertIntoTerminal(command: string) {
    if (activeSessionId) {
      window.sshApi.send(activeSessionId, command);
    }
  }

  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-2 mb-3', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-xs">AI</span>
        </div>
      )}
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        )}
      >
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
          {message.content || (message.role === 'assistant' ? '...' : '')}
        </pre>
        {!isUser && message.content && activeSessionId && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 h-6 text-xs px-2 opacity-70 hover:opacity-100"
            onClick={() => insertIntoTerminal(message.content)}
            title="Insert into terminal"
          >
            <Terminal className="h-3 w-3 mr-1" />
            Insert
          </Button>
        )}
      </div>
    </div>
  );
}
