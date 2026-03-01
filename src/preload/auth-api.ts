import { contextBridge, ipcRenderer } from 'electron';

const authApi = {
  setAccessToken: (accessToken: string | null) => ipcRenderer.invoke('auth.setAccessToken', accessToken),
  isE2EModeAllowed: (): Promise<boolean> => ipcRenderer.invoke('app.isE2EModeAllowed'),
};

contextBridge.exposeInMainWorld('authApi', authApi);

export type AuthApi = typeof authApi;
