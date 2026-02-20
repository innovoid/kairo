import { writeFileSync, mkdirSync, readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { logger } from '../lib/logger';

interface Recording {
  sessionId: string;
  startTime: number;
  events: Array<[number, string, string]>; // [relative_time_ms, type, data]
  header: { version: 2; width: number; height: number; timestamp: number };
}

const activeRecordings = new Map<string, Recording>();

function getRecordingsDir(): string {
  const dir = join(app.getPath('userData'), 'recordings');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export const recordingManager = {
  start(sessionId: string, cols: number, rows: number): void {
    if (activeRecordings.has(sessionId)) {
      logger.warn(`Recording already active for session ${sessionId}`);
      return;
    }

    const startTime = Date.now();
    const recording: Recording = {
      sessionId,
      startTime,
      events: [],
      header: {
        version: 2,
        width: cols,
        height: rows,
        timestamp: Math.floor(startTime / 1000),
      },
    };
    activeRecordings.set(sessionId, recording);
    logger.info(`Started recording for session ${sessionId}`);
  },

  appendData(sessionId: string, data: string): void {
    const recording = activeRecordings.get(sessionId);
    if (!recording) return;

    const relativeTime = (Date.now() - recording.startTime) / 1000; // seconds
    recording.events.push([relativeTime, 'o', data]);
  },

  stop(sessionId: string): string | null {
    const recording = activeRecordings.get(sessionId);
    if (!recording) {
      logger.warn(`No active recording for session ${sessionId}`);
      return null;
    }

    activeRecordings.delete(sessionId);

    const timestamp = new Date(recording.startTime);
    const filename = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}-${String(timestamp.getDate()).padStart(2, '0')}_${String(timestamp.getHours()).padStart(2, '0')}-${String(timestamp.getMinutes()).padStart(2, '0')}-${String(timestamp.getSeconds()).padStart(2, '0')}.cast`;
    const filepath = join(getRecordingsDir(), filename);

    // asciicast v2 format: header line + event lines
    const lines = [
      JSON.stringify(recording.header),
      ...recording.events.map((e) => JSON.stringify(e)),
    ];
    writeFileSync(filepath, lines.join('\n'), 'utf8');

    logger.info(`Saved recording to ${filepath}`);
    return filepath;
  },

  list(): Array<{ filename: string; path: string; timestamp: number }> {
    const dir = getRecordingsDir();
    if (!existsSync(dir)) return [];

    const files = readdirSync(dir).filter((f) => f.endsWith('.cast'));
    return files.map((filename) => {
      const filepath = join(dir, filename);
      const stat = require('fs').statSync(filepath);
      return {
        filename,
        path: filepath,
        timestamp: stat.mtimeMs,
      };
    });
  },

  read(path: string): string {
    return readFileSync(path, 'utf8');
  },

  isRecording(sessionId: string): boolean {
    return activeRecordings.has(sessionId);
  },
};
