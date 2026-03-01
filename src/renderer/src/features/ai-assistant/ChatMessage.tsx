import { cn } from '@/lib/utils';
import { Copy, Terminal } from 'lucide-react';
import { toast } from 'sonner';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  error?: string;
  onInsertCommand?: (command: string) => void;
}

// ── Minimal markdown renderer ─────────────────────────────────────────────────
// Handles: fenced code blocks, inline code, **bold**, line breaks.
// Returns an array of React nodes.

function renderContent(text: string, onInsert?: (cmd: string) => void): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const fenceRe = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRe.exec(text)) !== null) {
    // Text before this code block
    if (match.index > lastIndex) {
      nodes.push(
        <InlineText key={`t-${lastIndex}`} text={text.slice(lastIndex, match.index)} />
      );
    }

    const lang = match[1] || '';
    const code = match[2].trimEnd();
    const isShell = /^(ba)?sh|zsh|fish|sh|shell|cmd|powershell$/i.test(lang) || !lang;

    nodes.push(
      <CodeBlock
        key={`c-${match.index}`}
        code={code}
        lang={lang}
        isShell={isShell}
        onInsert={onInsert}
      />
    );

    lastIndex = fenceRe.lastIndex;
  }

  // Remaining text
  if (lastIndex < text.length) {
    nodes.push(
      <InlineText key={`t-${lastIndex}`} text={text.slice(lastIndex)} />
    );
  }

  return nodes;
}

// Renders inline text: **bold**, `code`, and newlines
function InlineText({ text }: { text: string }) {
  // Split by newlines first
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, li) => {
        // Split by **bold**
        const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        return (
          <span key={li}>
            {li > 0 && <br />}
            {parts.map((part, pi) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={pi} className="font-semibold text-zinc-100">{part.slice(2, -2)}</strong>;
              }
              if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
                return (
                  <code key={pi} className="font-mono text-[10px] text-primary/90 bg-surface-3/80 px-1 py-0.5 rounded">
                    {part.slice(1, -1)}
                  </code>
                );
              }
              return <span key={pi}>{part}</span>;
            })}
          </span>
        );
      })}
    </>
  );
}

function CodeBlock({
  code,
  lang,
  isShell,
  onInsert,
}: {
  code: string;
  lang: string;
  isShell: boolean;
  onInsert?: (cmd: string) => void;
}) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Copied');
    } catch {
      toast.error('Failed to copy');
    }
  }

  return (
    <div className="rounded-md border border-border overflow-hidden my-1.5">
      {/* Lang bar */}
      <div className="flex items-center justify-between px-2.5 py-1 bg-surface-1/80 border-b border-border/60">
        <span className="text-[9px] font-mono text-text-disabled">{lang || 'shell'}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-0.5 text-[9px] text-text-disabled hover:text-text-secondary transition-colors px-1.5 py-0.5 rounded hover:bg-surface-3"
          >
            <Copy className="h-2.5 w-2.5" />
            Copy
          </button>
          {isShell && onInsert && (
            <button
              type="button"
              onClick={() => onInsert(code)}
              className="flex items-center gap-0.5 text-[9px] text-primary hover:text-primary-hover transition-colors px-1.5 py-0.5 rounded hover:bg-primary/10"
            >
              <Terminal className="h-2.5 w-2.5" />
              Insert
            </button>
          )}
        </div>
      </div>
      <pre className="text-[10px] font-mono text-zinc-200 bg-black/50 px-3 py-2.5 overflow-x-auto leading-relaxed whitespace-pre">
        {code}
      </pre>
    </div>
  );
}

export function ChatMessage({ role, content, error, onInsertCommand }: ChatMessageProps) {
  const isUser = role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl rounded-tr-sm bg-primary/20 border border-primary/20 px-3 py-2">
          <p className="text-xs text-zinc-100 leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    );
  }

  // Error state — show a clear red error card
  if (error) {
    return (
      <div className="rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2.5">
        <p className="text-[10px] font-semibold text-red-400 mb-1">AI error</p>
        <p className="text-[11px] text-red-300/90 leading-relaxed font-mono">{error}</p>
      </div>
    );
  }

  return (
    <div className={cn('text-xs text-text-secondary leading-relaxed', !content && 'italic text-text-disabled')}>
      {!content ? (
        <span className="flex items-center gap-1">
          <span className="inline-block w-1 h-3 bg-primary rounded-sm animate-pulse" />
        </span>
      ) : (
        renderContent(content, onInsertCommand)
      )}
    </div>
  );
}
