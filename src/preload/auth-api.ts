import { contextBridge, ipcRenderer } from 'electron';

const authApi = {
  setAccessToken: (accessToken: string | null) => ipcRenderer.invoke('auth.setAccessToken', accessToken),
};

contextBridge.exposeInMainWorld('authApi', authApi);

export type AuthApi = typeof authApi;
