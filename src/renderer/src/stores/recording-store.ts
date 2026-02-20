import { create } from 'zustand';

interface RecordingStore {
  recordingSessions: Set<string>;
  startRecording: (sessionId: string) => void;
  stopRecording: (sessionId: string) => void;
  isRecording: (sessionId: string) => boolean;
}

export const useRecordingStore = create<RecordingStore>((set, get) => ({
  recordingSessions: new Set(),

  startRecording: (sessionId: string) => {
    set((state) => {
      const newSet = new Set(state.recordingSessions);
      newSet.add(sessionId);
      return { recordingSessions: newSet };
    });
  },

  stopRecording: (sessionId: string) => {
    set((state) => {
      const newSet = new Set(state.recordingSessions);
      newSet.delete(sessionId);
      return { recordingSessions: newSet };
    });
  },

  isRecording: (sessionId: string) => {
    return get().recordingSessions.has(sessionId);
  },
}));
