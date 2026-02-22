import { useState, useRef } from 'react';
import type { Terminal } from '@xterm/xterm';
import { Upload, Download, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

  // TODO: Add effects and handlers

  return null; // Will add UI next
}
