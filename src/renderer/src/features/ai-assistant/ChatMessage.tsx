import { cn } from '@/lib/utils';
import { CommandSuggestion } from './CommandSuggestion';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  command?: string;
  timestamp: string;
  onInsertCommand?: (command: string) => void;
}

export function ChatMessage({
  role,
  content,
  command,
  timestamp,
  onInsertCommand,
}: ChatMessageProps) {
  const isUser = role === 'user';
  const shouldShowCommand = !isUser && command;

  return (
    <div
      className={cn(
        'flex flex-col gap-2',
        isUser ? 'ml-8' : 'mr-8'
      )}
    >
      <div
        className={cn(
          'rounded-lg px-3 py-2 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        )}
      >
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
          {content}
        </pre>
      </div>

      {shouldShowCommand && (
        <CommandSuggestion
          command={command}
          onInsert={onInsertCommand}
        />
      )}
    </div>
  );
}
