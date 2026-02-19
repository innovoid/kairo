import { contextBridge, ipcRenderer } from 'electron';
import type { UserSettings, UpdateSettingsInput } from '../shared/types/settings';

const settingsApi = {
  get: (): Promise<UserSettings> =>
    ipcRenderer.invoke('settings.get'),
  update: (input: UpdateSettingsInput): Promise<UserSettings> =>
    ipcRenderer.invoke('settings.update', input),
};

contextBridge.exposeInMainWorld('settingsApi', settingsApi);

export type SettingsApi = typeof settingsApi;
