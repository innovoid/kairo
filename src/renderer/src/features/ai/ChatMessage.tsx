import type { AiMessage } from '@shared/types/ai';
import { cn } from '@/lib/utils';
import { useSessionStore } from '@/stores/session-store';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface ChatMessageProps {
  message: AiMessage;
}

// Extract bash commands from code blocks and inline $ commands
function extractCommands(content: string): string[] {
  const commands: string[] = [];

  // Extract code blocks
  const codeBlockRegex = /```(?:bash|sh|shell)?\n([\s\S]*?)```/g;
  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const cmd = match[1].trim();
    if (cmd) {
      commands.push(cmd);
    }
  }

  // Extract inline commands (lines starting with $)
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('$ ')) {
      commands.push(trimmed.substring(2));
    }
  }

  return commands;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const { tabs, activeTabId } = useSessionStore();

  function insertCommand(command: string) {
    const activeTab = tabs.get(activeTabId ?? '');

    if (!activeTab || activeTab.tabType !== 'terminal') {
      toast.error('Open a terminal first');
      return;
    }

    // Remove leading $ if present
    const sanitized = command.replace(/^\$\s*/, '');

    // Send to terminal (without \n so user can review before executing)
    window.sshApi.send(activeTab.sessionId!, sanitized);
    toast.success('Command inserted');
  }

  const isUser = message.role === 'user';
  const commands = message.role === 'assistant' ? extractCommands(message.content) : [];

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

        {commands.length > 0 && (
          <div className="space-y-2 mt-2">
            {commands.map((cmd, i) => (
              <div key={i} className="flex items-center gap-2">
                <code className="flex-1 bg-background px-2 py-1 rounded text-xs font-mono">
                  {cmd}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs"
                  onClick={() => insertCommand(cmd)}
                >
                  <ArrowRight className="h-3 w-3 mr-1" />
                  Insert
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
