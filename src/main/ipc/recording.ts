import type { IpcMainInvokeEvent } from 'electron';
import { recordingManager } from '../services/recording-manager';

export const recordingIpcHandlers = {
  start(_event: IpcMainInvokeEvent, sessionId: string, cols: number, rows: number): void {
    recordingManager.start(sessionId, cols, rows);
  },

  stop(_event: IpcMainInvokeEvent, sessionId: string): string | null {
    return recordingManager.stop(sessionId);
  },

  list(_event: IpcMainInvokeEvent): Array<{ filename: string; path: string; timestamp: number }> {
    return recordingManager.list();
  },

  read(_event: IpcMainInvokeEvent, path: string): string {
    return recordingManager.read(path);
  },

  isRecording(_event: IpcMainInvokeEvent, sessionId: string): boolean {
    return recordingManager.isRecording(sessionId);
  },
};
