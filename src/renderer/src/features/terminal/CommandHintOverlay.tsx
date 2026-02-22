import { useState, useRef, useEffect } from 'react';
import type { Terminal } from '@xterm/xterm';
import { Upload, Download, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings-store';

interface CommandHintOverlayProps {
  terminal: Terminal | null;
  sessionId: string;
  currentRemotePath?: string;
}

interface CommandHint {
  command: string;
  description: string;
  icon: typeof Upload;
  usage: string;
}

const COMMANDS: CommandHint[] = [
  {
    command: '@upload',
    description: 'Upload files to remote server',
    icon: Upload,
    usage: '@upload',
  },
  {
    command: '@download',
    description: 'Download file from remote server',
    icon: Download,
    usage: '@download <filename>',
  },
  {
    command: '@ai',
    description: 'Translate natural language to shell command',
    icon: Sparkles,
    usage: '@ai <describe what you want>',
  },
];

export function CommandHintOverlay({
  terminal,
  sessionId,
  currentRemotePath = '/home',
}: CommandHintOverlayProps) {
  const [inputBuffer, setInputBuffer] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [filteredCommands, setFilteredCommands] = useState<CommandHint[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isTranslating, setIsTranslating] = useState(false);
  const disposableRef = useRef<{ dispose: () => void } | null>(null);
  const { settings } = useSettingsStore();

  // Intercept keyboard events to handle @ commands
  useEffect(() => {
    if (!terminal) return;

    const handler = terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      // Only handle keydown events
      if (event.type !== 'keydown') return true;

      // Check for @ key to start menu
      if (event.key === '@' && !showMenu && !event.ctrlKey && !event.metaKey && !event.altKey) {
        setInputBuffer('@');
        setShowMenu(true);
        setFilteredCommands(COMMANDS);
        setSelectedIndex(0);
        return false; // Prevent @ from being sent to terminal
      }

      // If menu is not showing, allow default behavior
      if (!showMenu) return true;

      // Handle keys when menu is active
      if (event.key === 'Enter') {
        handleSelectCommand(filteredCommands[selectedIndex]);
        return false; // Prevent Enter from being sent
      } else if (event.key === 'Escape') {
        setShowMenu(false);
        setInputBuffer('');
        return false;
      } else if (event.key === 'ArrowUp') {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
        return false;
      } else if (event.key === 'ArrowDown') {
        setSelectedIndex((prev) => Math.min(filteredCommands.length - 1, prev + 1));
        return false;
      } else if (event.key === 'Tab') {
        // Tab key: auto-complete to selected command
        const selectedCommand = filteredCommands[selectedIndex];
        if (selectedCommand) {
          setInputBuffer(selectedCommand.command);
          // Keep only the exact match in filtered commands
          setFilteredCommands([selectedCommand]);
        }
        return false; // Prevent Tab from being sent
      } else if (event.key === 'Backspace') {
        const newBuffer = inputBuffer.slice(0, -1);
        if (newBuffer.length === 0 || !newBuffer.startsWith('@')) {
          setShowMenu(false);
          setInputBuffer('');
        } else {
          setInputBuffer(newBuffer);
          filterCommands(newBuffer);
        }
        return false;
      } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        // Regular character
        const newBuffer = inputBuffer + event.key;
        setInputBuffer(newBuffer);
        filterCommands(newBuffer);
        return false; // Prevent character from being sent
      }

      return true; // Allow other keys
    });

    return () => {
      if (handler) {
        terminal.attachCustomKeyEventHandler(() => true);
      }
    };
  }, [terminal, showMenu, inputBuffer, filteredCommands, selectedIndex]);

  function filterCommands(buffer: string) {
    const lower = buffer.toLowerCase();
    const matches = COMMANDS.filter((cmd) => cmd.command.toLowerCase().startsWith(lower));
    setFilteredCommands(matches);
    setSelectedIndex(0);
  }

  async function handleSelectCommand(command: CommandHint | undefined) {
    if (!command || !terminal) return;

    // Execute the command handler
    if (command.command === '@upload') {
      await handleUpload();
    } else if (command.command === '@download') {
      await handleDownload();
    } else if (command.command === '@ai') {
      await handleAiTranslation();
    }

    setShowMenu(false);
    setInputBuffer('');
  }

  async function handleUpload() {
    try {
      const files = await window.sftpApi.pickUploadFiles();
      if (!files || files.length === 0) return;

      for (const localPath of files) {
        const filename = localPath.split('/').pop() || 'file';
        const remotePath = `${currentRemotePath}/${filename}`.replace('//', '/');

        toast.promise(
          window.sftpApi.upload(sessionId, localPath, remotePath),
          {
            loading: `Uploading ${filename}...`,
            success: `Uploaded ${filename}`,
            error: (err) => `Upload failed: ${err.message}`,
          }
        );
      }
    } catch (err: any) {
      if (err.message?.includes('SFTP')) {
        toast.error('No SFTP connection. Open SFTP first (Cmd+Shift+F)');
      } else {
        toast.error(`Upload failed: ${err.message}`);
      }
    }
  }

  async function handleDownload() {
    // Parse filename from buffer
    const parts = inputBuffer.split(' ');
    if (parts.length < 2) {
      toast.error('Usage: @download <filename>');
      return;
    }

    const filename = parts.slice(1).join(' ');
    const remotePath = `${currentRemotePath}/${filename}`.replace('//', '/');

    try {
      toast.promise(
        window.sftpApi.download(sessionId, remotePath),
        {
          loading: `Downloading ${filename}...`,
          success: `Downloaded ${filename} to Downloads folder`,
          error: (err) => `Download failed: ${err.message}`,
        }
      );
    } catch (err: any) {
      if (err.message?.includes('not found')) {
        toast.error(`File not found: ${filename}`);
      } else if (err.message?.includes('SFTP')) {
        toast.error('No SFTP connection. Open SFTP first (Cmd+Shift+F)');
      } else {
        toast.error(`Download failed: ${err.message}`);
      }
    }
  }

  async function handleAiTranslation() {
    // Parse natural language query from buffer
    const parts = inputBuffer.split(' ');
    if (parts.length < 2) {
      toast.error('Usage: @ai <describe what you want>');
      return;
    }

    const naturalLanguage = parts.slice(1).join(' ');

    // Check AI configuration
    if (!settings?.openaiApiKeyEncrypted && !settings?.anthropicApiKeyEncrypted) {
      toast.error('Configure AI provider in Settings (Cmd+,)');
      return;
    }

    setIsTranslating(true);

    try {
      const requestId = crypto.randomUUID();
      let translatedCommand = '';

      // Listen for chunks
      const offChunk = window.aiApi.onChunk((id, chunk) => {
        if (id === requestId) {
          translatedCommand += chunk;
        }
      });

      const offDone = window.aiApi.onDone((id) => {
        if (id === requestId) {
          setIsTranslating(false);
          // Write translated command to terminal (don't execute)
          if (terminal) {
            terminal.write(translatedCommand);
          }
          toast.success('Command translated');
          offChunk();
          offDone();
          offError();
        }
      });

      const offError = window.aiApi.onError((id, error) => {
        if (id === requestId) {
          setIsTranslating(false);
          toast.error(`AI translation failed: ${error}`);
          offChunk();
          offDone();
          offError();
        }
      });

      // Call AI translation
      await window.aiApi.translateCommand({
        provider: settings?.openaiApiKeyEncrypted ? 'openai' : 'anthropic',
        apiKey: settings?.openaiApiKeyEncrypted || settings?.anthropicApiKeyEncrypted || '',
        model: 'gpt-4o-mini',
        naturalLanguage,
        requestId,
      });
    } catch (err: any) {
      setIsTranslating(false);
      toast.error(`AI translation failed: ${err.message}`);
    }
  }

  if (!showMenu || filteredCommands.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-4 z-50">
      <div className="bg-[var(--surface-3)] border border-[var(--border)] rounded-lg shadow-2xl overflow-hidden min-w-[320px]">
        {/* Header */}
        <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-4)]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Command Hints</span>
            {isTranslating && (
              <span className="text-xs text-blue-400 flex items-center gap-1">
                <span className="animate-spin">⏳</span>
                Translating...
              </span>
            )}
          </div>
        </div>

        {/* Commands List */}
        <div className="py-1">
          {filteredCommands.map((cmd, index) => {
            const Icon = cmd.icon;
            const isSelected = index === selectedIndex;

            return (
              <button
                key={cmd.command}
                onClick={() => handleSelectCommand(cmd)}
                className={cn(
                  'w-full px-3 py-2 flex items-start gap-3 transition-colors text-left',
                  isSelected ? 'bg-primary/20' : 'hover:bg-accent/50'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 mt-0.5 shrink-0',
                    isSelected ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{cmd.command}</div>
                  <div className="text-xs text-muted-foreground">{cmd.description}</div>
                  <div className="text-xs text-muted-foreground/70 font-mono mt-1">
                    {cmd.usage}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-[var(--border)] bg-[var(--surface-4)]">
          <div className="text-xs text-muted-foreground">
            <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd> Navigate{' '}
            <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Tab</kbd> Complete{' '}
            <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> Select{' '}
            <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Esc</kbd> Close
          </div>
        </div>
      </div>
    </div>
  );
}
