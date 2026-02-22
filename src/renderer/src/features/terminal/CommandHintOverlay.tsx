import { useEffect, useRef } from 'react';
import type { Terminal } from '@xterm/xterm';
import { toast } from 'sonner';
import { useSettingsStore } from '@/stores/settings-store';
import { useAgentStore } from '@/stores/agent-store';
import type { AgentRun, AgentStep } from '@shared/types/agent';

interface CommandHintOverlayProps {
  terminal: Terminal | null;
  sessionId: string;
  currentRemotePath?: string;
  hostId?: string;
  hostLabel?: string;
}

interface CommandHint {
  command: string;
  description: string;
  usage: string;
}

interface HintLine {
  text: string;
  tone?: 'muted' | 'active' | 'header';
}

const COMMANDS: CommandHint[] = [
  {
    command: '@upload',
    description: 'Upload files to remote server',
    usage: '@upload',
  },
  {
    command: '@download',
    description: 'Download file from remote server',
    usage: '@download <filename>',
  },
  {
    command: '@ai',
    description: 'Translate natural language to shell command',
    usage: '@ai <describe what you want>',
  },
  {
    command: '@agent',
    description: 'Run AI operator workflow with step approvals',
    usage: '@agent <task>',
  },
];

export function CommandHintOverlay({
  terminal,
  sessionId,
  currentRemotePath = '/home',
  hostId,
  hostLabel,
}: CommandHintOverlayProps) {
  const commandModeRef = useRef(false);
  const inputBufferRef = useRef('');
  const hintLineCountRef = useRef(0);
  const currentMatchesRef = useRef<CommandHint[]>([]);
  const selectedIndexRef = useRef(0);
  const selectedAgentStepIdxRef = useRef(0);
  const pendingDoubleConfirmStepIdRef = useRef<string | null>(null);
  const activeRunRef = useRef<AgentRun | null>(null);
  const stepOutputByStepIdRef = useRef<Record<string, string>>({});
  const settingsRef = useRef(useSettingsStore.getState().settings);
  const { settings } = useSettingsStore();
  const initAgentListeners = useAgentStore((s) => s.initListeners);
  const startAgentRun = useAgentStore((s) => s.startRun);
  const approveAgentStep = useAgentStore((s) => s.approveStep);
  const cancelAgentRun = useAgentStore((s) => s.cancelRun);
  const activeRunId = useAgentStore((s) => s.activeRunBySession[sessionId]);
  const activeRun = useAgentStore((s) => (activeRunId ? s.runs[activeRunId] : null));
  const stepOutputByStepId = useAgentStore((s) => s.stepOutputByStepId);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    initAgentListeners();
  }, [initAgentListeners]);

  useEffect(() => {
    activeRunRef.current = activeRun;
    if (activeRun) {
      const approvalIdx = activeRun.steps.findIndex(
        (step) => step.status === 'awaiting_approval' || step.status === 'blocked'
      );
      if (approvalIdx >= 0) {
        selectedAgentStepIdxRef.current = approvalIdx;
      }
    }
    if (!commandModeRef.current) {
      renderAgentHints();
    }
  }, [activeRun]);

  useEffect(() => {
    stepOutputByStepIdRef.current = stepOutputByStepId;
    if (!commandModeRef.current) {
      renderAgentHints();
    }
  }, [stepOutputByStepId]);

  const getStatusGlyph = (status: AgentStep['status']) => {
    if (status === 'done') return '✓';
    if (status === 'failed') return '✗';
    if (status === 'running') return '…';
    if (status === 'awaiting_approval') return '!';
    if (status === 'blocked') return '⚠';
    if (status === 'skipped') return '-';
    return '·';
  };

  const renderAgentHints = () => {
    const run = activeRunRef.current;
    if (!run) {
      clearHintLines();
      return;
    }

    const steps = run.steps;
    if (steps.length === 0) {
      renderHintLines([
        { text: `Agent: ${run.task}`, tone: 'header' },
        { text: `Status: ${run.status}` },
      ]);
      return;
    }

    if (selectedAgentStepIdxRef.current >= steps.length) {
      selectedAgentStepIdxRef.current = steps.length - 1;
    }
    if (selectedAgentStepIdxRef.current < 0) {
      selectedAgentStepIdxRef.current = 0;
    }

    const maxVisible = 5;
    const windowStart = Math.max(
      0,
      Math.min(selectedAgentStepIdxRef.current - 2, Math.max(0, steps.length - maxVisible))
    );
    const visibleSteps = steps.slice(windowStart, windowStart + maxVisible);

    const footer = run.status === 'awaiting_approval' || run.status === 'blocked'
      ? 'Enter approve  Tab preview command  ↑/↓ select  Esc cancel'
      : run.status === 'running'
        ? 'Agent executing...'
        : `Run ${run.status}`;

    const selectedStep = steps[selectedAgentStepIdxRef.current];
    const rawOutput = selectedStep
      ? stepOutputByStepIdRef.current[selectedStep.id] ?? selectedStep.outputSummary ?? ''
      : '';
    const outputPreview = rawOutput
      .replace(/\x1b\[[0-9;]*m/g, '')
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .slice(-1)[0];

    renderHintLines([
      { text: `Agent: ${run.task}`, tone: 'header' },
      ...visibleSteps.map((step, idx) => {
        const absoluteIdx = windowStart + idx;
        const active = absoluteIdx === selectedAgentStepIdxRef.current;
        return {
          text: `${active ? '›' : ' '} [${getStatusGlyph(step.status)}] ${step.title}`,
          tone: active ? 'active' : 'muted',
        } as HintLine;
      }),
      run.lastError ? { text: `Error: ${run.lastError}`, tone: 'muted' } : { text: footer, tone: 'muted' },
      outputPreview ? { text: `Output: ${outputPreview.slice(0, 96)}`, tone: 'muted' } : { text: '' },
    ]);
  };

  const renderHintLines = (lines: HintLine[]) => {
    if (!terminal) return;

    const normalizedLines = lines.filter((line) => line.text.trim().length > 0);
    const maxLines = Math.max(hintLineCountRef.current, normalizedLines.length);

    terminal.write('\x1b7');

    // Move one row down at a time to keep the block tightly aligned below the prompt.
    for (let i = 0; i < maxLines; i += 1) {
      terminal.write('\x1b[B\r\x1b[2K');
      if (i < normalizedLines.length) {
        const line = normalizedLines[i];
        if (line.tone === 'active') {
          terminal.write(`\x1b[1;96m${line.text}\x1b[0m`);
        } else if (line.tone === 'header') {
          terminal.write(`\x1b[37m${line.text}\x1b[0m`);
        } else {
          terminal.write(`\x1b[90m${line.text}\x1b[0m`);
        }
      }
    }

    hintLineCountRef.current = normalizedLines.length;
    terminal.write('\x1b8');
  };

  const clearHintLines = () => {
    if (hintLineCountRef.current === 0) return;
    renderHintLines([]);
  };

  const updateHintLine = () => {
    const [commandToken, ...rest] = inputBufferRef.current.split(' ');
    if (!commandToken.startsWith('@')) {
      currentMatchesRef.current = [];
      selectedIndexRef.current = 0;
      clearHintLines();
      return;
    }

    if (rest.length > 0) {
      currentMatchesRef.current = [];
      selectedIndexRef.current = 0;
      const exact = COMMANDS.find((cmd) => cmd.command === commandToken);
      if (exact) {
        renderHintLines([
          { text: `${exact.command}  ${exact.description}`, tone: 'header' },
          { text: `Usage: ${exact.usage}` },
        ]);
      } else {
        renderHintLines([
          { text: 'Unknown command.', tone: 'header' },
          { text: 'Available: @upload, @download, @ai, @agent' },
        ]);
      }
      return;
    }

    const matches = COMMANDS.filter((cmd) => cmd.command.startsWith(commandToken));
    if (matches.length === 0) {
      currentMatchesRef.current = [];
      selectedIndexRef.current = 0;
      renderHintLines([{ text: 'No matching commands' }]);
      return;
    }

    const prevSelectedCommand = currentMatchesRef.current[selectedIndexRef.current]?.command;
    currentMatchesRef.current = matches;

    if (prevSelectedCommand) {
      const newSelectedIdx = matches.findIndex((cmd) => cmd.command === prevSelectedCommand);
      selectedIndexRef.current = newSelectedIdx >= 0 ? newSelectedIdx : 0;
    }

    if (selectedIndexRef.current >= matches.length) {
      selectedIndexRef.current = 0;
    }

    const maxVisible = 5;
    const windowStart = Math.max(
      0,
      Math.min(selectedIndexRef.current - 2, Math.max(0, matches.length - maxVisible))
    );
    const visibleMatches = matches.slice(windowStart, windowStart + maxVisible);

    renderHintLines([
      { text: 'Hints (↑/↓ navigate, Tab complete):', tone: 'header' },
      ...visibleMatches.map((cmd, idx) => {
        const absoluteIdx = windowStart + idx;
        const isActive = absoluteIdx === selectedIndexRef.current;
        return {
          text: `${isActive ? '›' : ' '} ${cmd.command}  ${cmd.description}`,
          tone: isActive ? 'active' : 'muted',
        } as HintLine;
      }),
      matches.length > maxVisible
        ? { text: `${matches.length - visibleMatches.length} more matches`, tone: 'muted' }
        : { text: '' },
    ]);
  };

  const resetCommandMode = () => {
    clearHintLines();
    commandModeRef.current = false;
    inputBufferRef.current = '';
    currentMatchesRef.current = [];
    selectedIndexRef.current = 0;
    pendingDoubleConfirmStepIdRef.current = null;
    if (activeRunRef.current) {
      renderAgentHints();
    }
  };

  const eraseCurrentBuffer = () => {
    if (!terminal || inputBufferRef.current.length === 0) return;
    clearHintLines();
    terminal.write('\b \b'.repeat(inputBufferRef.current.length));
    inputBufferRef.current = '';
  };

  useEffect(() => {
    if (!terminal) return;

    terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      const consume = () => {
        event.preventDefault();
        event.stopPropagation();
        setTimeout(() => terminal.focus(), 0);
        return false;
      };

      if (event.type !== 'keydown') {
        return !commandModeRef.current;
      }

      const run = activeRunRef.current;
      if (!commandModeRef.current && run && (run.status === 'awaiting_approval' || run.status === 'blocked')) {
        if (event.key === 'ArrowDown') {
          selectedAgentStepIdxRef.current = Math.min(
            run.steps.length - 1,
            selectedAgentStepIdxRef.current + 1
          );
          renderAgentHints();
          return consume();
        }

        if (event.key === 'ArrowUp') {
          selectedAgentStepIdxRef.current = Math.max(0, selectedAgentStepIdxRef.current - 1);
          renderAgentHints();
          return consume();
        }

        if (event.key === 'Tab') {
          const selectedStep = run.steps[selectedAgentStepIdxRef.current];
          if (selectedStep) {
            terminal.write(selectedStep.command);
          }
          return consume();
        }

        if (event.key === 'Enter') {
          const selectedStep = run.steps[selectedAgentStepIdxRef.current];
          if (!selectedStep) return consume();
          if (selectedStep.status !== 'awaiting_approval' && selectedStep.status !== 'blocked') {
            toast.info('Select a step awaiting approval.');
            return consume();
          }

          if (selectedStep.requiresDoubleConfirm && pendingDoubleConfirmStepIdRef.current !== selectedStep.id) {
            pendingDoubleConfirmStepIdRef.current = selectedStep.id;
            toast.warning('Press Enter again to confirm destructive command.');
            renderAgentHints();
            return consume();
          }

          pendingDoubleConfirmStepIdRef.current = null;
          void approveAgentStep(run.id, selectedStep, {
            elevate: selectedStep.risk === 'needs_privilege',
            doubleConfirm: selectedStep.requiresDoubleConfirm,
          });
          return consume();
        }

        if (event.key === 'Escape') {
          void cancelAgentRun(run.id);
          return consume();
        }
      }

      if (
        event.key === '@' &&
        !commandModeRef.current &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        commandModeRef.current = true;
        inputBufferRef.current = '@';
        terminal.write('@');
        updateHintLine();
        return consume();
      }

      if (!commandModeRef.current) return true;

      if (event.ctrlKey || event.metaKey || event.altKey) {
        resetCommandMode();
        return true;
      }

      if (event.key === 'Escape') {
        eraseCurrentBuffer();
        resetCommandMode();
        return consume();
      }

      if (event.key === 'Backspace') {
        if (inputBufferRef.current.length === 0) {
          resetCommandMode();
          return consume();
        }

        inputBufferRef.current = inputBufferRef.current.slice(0, -1);
        terminal.write('\b \b');

        if (inputBufferRef.current.length === 0) {
          resetCommandMode();
        } else {
          updateHintLine();
        }

        return consume();
      }

      if (event.key === 'Tab') {
        const [commandToken, ...rest] = inputBufferRef.current.split(' ');
        if (rest.length === 0) {
          const match =
            currentMatchesRef.current[selectedIndexRef.current] ??
            COMMANDS.find((cmd) => cmd.command.startsWith(commandToken));
          if (match && match.command !== commandToken) {
            const remaining = match.command.slice(commandToken.length);
            terminal.write(remaining);
            inputBufferRef.current = match.command;
          }
          updateHintLine();
        }
        return consume();
      }

      if (event.key === 'ArrowDown') {
        if (currentMatchesRef.current.length > 0) {
          selectedIndexRef.current =
            (selectedIndexRef.current + 1) % currentMatchesRef.current.length;
          updateHintLine();
        }
        return consume();
      }

      if (event.key === 'ArrowUp') {
        if (currentMatchesRef.current.length > 0) {
          selectedIndexRef.current =
            (selectedIndexRef.current - 1 + currentMatchesRef.current.length) %
            currentMatchesRef.current.length;
          updateHintLine();
        }
        return consume();
      }

      if (event.key === 'Enter') {
        const buffer = inputBufferRef.current.trim();
        resetCommandMode();

        if (!buffer.startsWith('@')) {
          terminal.write('\r\n');
          return consume();
        }

        terminal.write('\r\n');
        void handleCommand(buffer);
        return consume();
      }

      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        inputBufferRef.current += event.key;
        terminal.write(event.key);

        updateHintLine();
        return consume();
      }

      return consume();
    });

    return () => {
      clearHintLines();
      terminal.attachCustomKeyEventHandler(() => true);
    };
  }, [terminal]);

  async function handleCommand(buffer: string) {
    const [commandToken, ...args] = buffer.split(' ');
    if (commandToken === '@upload') {
      await handleUpload();
      return;
    }

    if (commandToken === '@download') {
      await handleDownload(args.join(' ').trim());
      return;
    }

    if (commandToken === '@ai') {
      await handleAiTranslation(args.join(' ').trim());
      return;
    }

    if (commandToken === '@agent') {
      await handleAgentTask(args.join(' ').trim());
      return;
    }

    toast.error('Unknown command. Available: @upload, @download, @ai, @agent');
  }

  async function handleUpload() {
    try {
      const files = await window.sftpApi.pickUploadFiles();
      if (!files || files.length === 0) return;

      for (const localPath of files) {
        const filename = localPath.split('/').pop() || 'file';
        const remotePath = `${currentRemotePath}/${filename}`.replace('//', '/');

        toast.promise(
          window.sftpApi.upload(sessionId, localPath, remotePath, crypto.randomUUID()),
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

  async function handleDownload(filename: string) {
    if (!filename) {
      toast.error('Usage: @download <filename>');
      return;
    }

    const remotePath = `${currentRemotePath}/${filename}`.replace('//', '/');
    const localPath = window.prompt('Save downloaded file as:', filename);
    if (!localPath?.trim()) return;

    try {
      toast.promise(
        window.sftpApi.download(sessionId, remotePath, localPath.trim(), crypto.randomUUID()),
        {
          loading: `Downloading ${filename}...`,
          success: `Downloaded ${filename}`,
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

  async function handleAiTranslation(naturalLanguage: string) {
    if (!naturalLanguage) {
      toast.error('Usage: @ai <describe what you want>');
      return;
    }

    const provider = settingsRef.current?.aiProvider ?? 'openai';
    const apiKey = await window.apiKeysApi.get(provider);

    if (!apiKey) {
      toast.error(`No API key configured for ${provider}. Go to Settings → AI to add your key.`);
      return;
    }

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
          toast.error(`AI translation failed: ${error}`);
          offChunk();
          offDone();
          offError();
        }
      });

      // Call AI translation
      const model =
        provider === 'openai'
          ? 'gpt-4o-mini'
          : provider === 'anthropic'
            ? 'claude-haiku-3-5'
            : 'gemini-2.0-flash';

      await window.aiApi.translateCommand({
        provider,
        apiKey,
        model,
        naturalLanguage,
        requestId,
      });
    } catch (err: any) {
      toast.error(`AI translation failed: ${err.message}`);
    }
  }

  async function handleAgentTask(task: string) {
    if (!task) {
      toast.error('Usage: @agent <task>');
      return;
    }

    try {
      const run = await startAgentRun({
        sessionId,
        task,
        hostId,
        hostLabel,
      });
      activeRunRef.current = run;
      selectedAgentStepIdxRef.current = 0;
      renderAgentHints();
      toast.success('Agent plan ready. Review steps and press Enter to approve.');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to start agent run');
    }
  }

  return null;
}
