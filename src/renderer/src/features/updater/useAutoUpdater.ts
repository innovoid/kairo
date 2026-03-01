import { useState, useEffect, useCallback } from 'react';

export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'       // info received, download starting
  | 'downloading'     // progress 0-100
  | 'ready'           // downloaded, waiting for user action
  | 'error';

export interface UpdateState {
  phase: UpdatePhase;
  version: string | null;
  percent: number;            // 0-100 during download
  bytesPerSecond: number;
  releaseNotes: string | null;
  errorMessage: string | null;
  dismissed: boolean;         // user clicked "Later" on the ready modal
}

export interface UpdateActions {
  download: () => void;
  installAndRestart: () => void;
  dismiss: () => void;
  checkNow: () => void;
}

const INITIAL: UpdateState = {
  phase: 'idle',
  version: null,
  percent: 0,
  bytesPerSecond: 0,
  releaseNotes: null,
  errorMessage: null,
  dismissed: false,
};

/**
 * Central update state manager.
 * Drives both the download banner and the restart-prompt modal.
 */
export function useAutoUpdater(): [UpdateState, UpdateActions] {
  const [state, setState] = useState<UpdateState>(INITIAL);

  useEffect(() => {
    if (!window.updaterApi) return;

    const offAvailable = window.updaterApi.onUpdateAvailable((info) => {
      setState((s) => ({
        ...s,
        phase: 'available',
        version: info.version,
        releaseNotes: info.releaseNotes ?? null,
        dismissed: false,
      }));
      // Kick off download automatically
      void window.updaterApi.downloadUpdate();
    });

    const offProgress = window.updaterApi.onDownloadProgress((progress) => {
      setState((s) => ({
        ...s,
        phase: 'downloading',
        percent: Math.round(progress.percent),
        bytesPerSecond: progress.bytesPerSecond,
      }));
    });

    const offDownloaded = window.updaterApi.onUpdateDownloaded((info) => {
      setState((s) => ({
        ...s,
        phase: 'ready',
        version: info.version,
        releaseNotes: info.releaseNotes ?? null,
        percent: 100,
      }));
    });

    const offError = window.updaterApi.onError((message) => {
      if (message.includes('No published versions') || message.includes('dev')) return;
      setState((s) => ({ ...s, phase: 'error', errorMessage: message }));
    });

    return () => {
      offAvailable();
      offProgress();
      offDownloaded();
      offError();
    };
  }, []);

  const download = useCallback(() => {
    void window.updaterApi?.downloadUpdate();
  }, []);

  const installAndRestart = useCallback(() => {
    void window.updaterApi?.installAndRestart();
  }, []);

  const dismiss = useCallback(() => {
    setState((s) => ({ ...s, dismissed: true }));
  }, []);

  const checkNow = useCallback(() => {
    setState((s) => ({ ...s, phase: 'checking', errorMessage: null }));
    void window.updaterApi?.checkForUpdates();
  }, []);

  return [state, { download, installAndRestart, dismiss, checkNow }];
}
