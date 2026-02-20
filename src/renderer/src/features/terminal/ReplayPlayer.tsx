import { useState, useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Play, Pause, RotateCcw, X } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import '@xterm/xterm/css/xterm.css';

interface ReplayPlayerProps {
  recordingPath: string;
  onClose: () => void;
}

interface AsciicastHeader {
  version: 2;
  width: number;
  height: number;
  timestamp: number;
}

interface AsciicastEvent {
  time: number;
  type: 'o' | 'i';
  data: string;
}

export function ReplayPlayer({ recordingPath, onClose }: ReplayPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [events, setEvents] = useState<AsciicastEvent[]>([]);
  const [header, setHeader] = useState<AsciicastHeader | null>(null);
  const playbackRef = useRef<{ timeout?: NodeJS.Timeout; eventIndex: number }>({
    eventIndex: 0,
  });

  useEffect(() => {
    loadRecording();
  }, [recordingPath]);

  useEffect(() => {
    if (!containerRef.current || !header) return;

    const terminal = new Terminal({
      cols: header.width,
      rows: header.height,
      cursorBlink: false,
      disableStdin: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    return () => {
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [header]);

  async function loadRecording() {
    const content = await window.recordingApi.read(recordingPath);
    const lines = content.split('\n').filter((line) => line.trim());

    if (lines.length === 0) return;

    // Parse header (first line)
    const headerData = JSON.parse(lines[0]) as AsciicastHeader;
    setHeader(headerData);

    // Parse events (remaining lines)
    const parsedEvents: AsciicastEvent[] = lines.slice(1).map((line) => {
      const [time, type, data] = JSON.parse(line) as [number, string, string];
      return { time, type: type as 'o' | 'i', data };
    });

    setEvents(parsedEvents);

    if (parsedEvents.length > 0) {
      setDuration(parsedEvents[parsedEvents.length - 1].time);
    }
  }

  function reset() {
    setIsPlaying(false);
    setCurrentTime(0);
    playbackRef.current.eventIndex = 0;
    if (playbackRef.current.timeout) {
      clearTimeout(playbackRef.current.timeout);
    }
    terminalRef.current?.reset();
  }

  function play() {
    if (!terminalRef.current || events.length === 0) return;

    setIsPlaying(true);
    scheduleNextEvent();
  }

  function pause() {
    setIsPlaying(false);
    if (playbackRef.current.timeout) {
      clearTimeout(playbackRef.current.timeout);
    }
  }

  function scheduleNextEvent() {
    const { eventIndex } = playbackRef.current;

    if (eventIndex >= events.length) {
      setIsPlaying(false);
      return;
    }

    const event = events[eventIndex];
    const nextEvent = events[eventIndex + 1];

    // Write current event
    if (event.type === 'o') {
      terminalRef.current?.write(event.data);
    }

    setCurrentTime(event.time);
    playbackRef.current.eventIndex++;

    // Schedule next event
    if (nextEvent) {
      const delay = (nextEvent.time - event.time) * 1000; // Convert to ms
      playbackRef.current.timeout = setTimeout(() => {
        scheduleNextEvent();
      }, delay);
    } else {
      setIsPlaying(false);
    }
  }

  function seek(value: number[]) {
    const targetTime = value[0];
    setCurrentTime(targetTime);

    // Find the event index for this time
    let targetIndex = 0;
    for (let i = 0; i < events.length; i++) {
      if (events[i].time <= targetTime) {
        targetIndex = i + 1;
      } else {
        break;
      }
    }

    // Reset terminal and replay up to target
    terminalRef.current?.reset();
    for (let i = 0; i < targetIndex; i++) {
      if (events[i].type === 'o') {
        terminalRef.current?.write(events[i].data);
      }
    }

    playbackRef.current.eventIndex = targetIndex;

    // If we were playing, continue playing
    if (isPlaying) {
      pause();
      setTimeout(() => play(), 0);
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Recording Playback</DialogTitle>
        </DialogHeader>
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <div
            ref={containerRef}
            className="flex-1 bg-[#09090b] p-2 rounded-md overflow-hidden"
          />
          <div className="space-y-2">
            <Slider
              value={[currentTime]}
              min={0}
              max={duration}
              step={0.1}
              onValueChange={seek}
              disabled={events.length === 0}
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isPlaying ? (
                  <Button variant="outline" size="sm" onClick={pause}>
                    <Pause className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={play}>
                    <Play className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={reset}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
