import { contextBridge, ipcRenderer } from "electron";
const authApi = {
  setAccessToken: (accessToken) => ipcRenderer.invoke("auth.setAccessToken", accessToken)
};
contextBridge.exposeInMainWorld("authApi", authApi);
const workspaceApi = {
  create: (input) => ipcRenderer.invoke("workspace.create", input),
  listMine: () => ipcRenderer.invoke("workspace.listMine"),
  switchActive: (workspaceId) => ipcRenderer.invoke("workspace.switchActive", workspaceId),
  invite: (input) => ipcRenderer.invoke("workspace.invite", input),
  acceptInvite: (input) => ipcRenderer.invoke("workspace.acceptInvite", input.token),
  revokeInvite: (workspaceInviteId) => ipcRenderer.invoke("workspace.revokeInvite", workspaceInviteId),
  members: {
    list: (workspaceId) => ipcRenderer.invoke("workspace.members.list", workspaceId),
    updateRole: (input) => ipcRenderer.invoke("workspace.members.updateRole", input),
    remove: (workspaceId, userId) => ipcRenderer.invoke("workspace.members.remove", workspaceId, userId)
  },
  getActiveContext: () => ipcRenderer.invoke("workspace.getActiveContext"),
  ensurePersonalWorkspace: (name) => ipcRenderer.invoke("workspace.ensurePersonalWorkspace", name),
  update: (workspaceId, updates) => ipcRenderer.invoke("workspace.updateWorkspace", workspaceId, updates),
  delete: (workspaceId) => ipcRenderer.invoke("workspace.deleteWorkspace", workspaceId),
  leave: (workspaceId) => ipcRenderer.invoke("workspace.leaveWorkspace", workspaceId)
};
contextBridge.exposeInMainWorld("workspaceApi", workspaceApi);
const hostsApi = {
  list: (workspaceId) => ipcRenderer.invoke("hosts.list", workspaceId),
  create: (input) => ipcRenderer.invoke("hosts.create", input),
  update: (id, input) => ipcRenderer.invoke("hosts.update", id, input),
  delete: (id) => ipcRenderer.invoke("hosts.delete", id),
  moveToFolder: (id, folderId) => ipcRenderer.invoke("hosts.moveToFolder", id, folderId)
};
const foldersApi = {
  list: (workspaceId) => ipcRenderer.invoke("folders.list", workspaceId),
  create: (input) => ipcRenderer.invoke("folders.create", input),
  update: (id, name) => ipcRenderer.invoke("folders.update", id, name),
  delete: (id) => ipcRenderer.invoke("folders.delete", id)
};
contextBridge.exposeInMainWorld("hostsApi", hostsApi);
contextBridge.exposeInMainWorld("foldersApi", foldersApi);
const sshApi = {
  connect: (sessionId, config) => ipcRenderer.invoke("ssh.connect", sessionId, config),
  disconnect: (sessionId) => ipcRenderer.invoke("ssh.disconnect", sessionId),
  send: (sessionId, data) => ipcRenderer.invoke("ssh.send", sessionId, data),
  resize: (sessionId, cols, rows) => ipcRenderer.invoke("ssh.resize", sessionId, cols, rows),
  onData: (callback) => {
    const listener = (_event, sessionId, data) => callback(sessionId, data);
    ipcRenderer.on("ssh:data", listener);
    return () => void ipcRenderer.removeListener("ssh:data", listener);
  },
  onClosed: (callback) => {
    const listener = (_event, sessionId) => callback(sessionId);
    ipcRenderer.on("ssh:closed", listener);
    return () => void ipcRenderer.removeListener("ssh:closed", listener);
  },
  onError: (callback) => {
    const listener = (_event, sessionId, error) => callback(sessionId, error);
    ipcRenderer.on("ssh:error", listener);
    return () => void ipcRenderer.removeListener("ssh:error", listener);
  }
};
contextBridge.exposeInMainWorld("sshApi", sshApi);
const sftpApi = {
  list: (sessionId, remotePath) => ipcRenderer.invoke("sftp.list", sessionId, remotePath),
  download: (sessionId, remotePath, localPath, transferId) => ipcRenderer.invoke("sftp.download", sessionId, remotePath, localPath, transferId),
  upload: (sessionId, localPath, remotePath, transferId) => ipcRenderer.invoke("sftp.upload", sessionId, localPath, remotePath, transferId),
  mkdir: (sessionId, remotePath) => ipcRenderer.invoke("sftp.mkdir", sessionId, remotePath),
  rename: (sessionId, oldPath, newPath) => ipcRenderer.invoke("sftp.rename", sessionId, oldPath, newPath),
  delete: (sessionId, remotePath, isDir) => ipcRenderer.invoke("sftp.delete", sessionId, remotePath, isDir),
  chmod: (sessionId, remotePath, mode) => ipcRenderer.invoke("sftp.chmod", sessionId, remotePath, mode),
  onProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on("sftp:progress", listener);
    return () => void ipcRenderer.removeListener("sftp:progress", listener);
  },
  pickUploadFiles: () => ipcRenderer.invoke("sftp.pickUploadFiles")
};
contextBridge.exposeInMainWorld("sftpApi", sftpApi);
const keysApi = {
  list: (workspaceId) => ipcRenderer.invoke("keys.list", workspaceId),
  import: (input) => ipcRenderer.invoke("keys.import", input),
  delete: (id) => ipcRenderer.invoke("keys.delete", id),
  exportPublic: (id) => ipcRenderer.invoke("keys.exportPublic", id),
  syncEncrypted: (id) => ipcRenderer.invoke("keys.syncEncrypted", id),
  // Workspace encryption
  isWorkspaceEncryptionInitialized: (workspaceId) => ipcRenderer.invoke("keys.isWorkspaceEncryptionInitialized", workspaceId),
  initializeWorkspaceEncryption: (workspaceId, passphrase) => ipcRenderer.invoke("keys.initializeWorkspaceEncryption", workspaceId, passphrase),
  verifyWorkspacePassphrase: (workspaceId, passphrase) => ipcRenderer.invoke("keys.verifyWorkspacePassphrase", workspaceId, passphrase),
  syncKeyToCloud: (workspaceId, keyId, passphrase) => ipcRenderer.invoke("keys.syncKeyToCloud", workspaceId, keyId, passphrase),
  downloadKeyFromCloud: (workspaceId, keyId, passphrase) => ipcRenderer.invoke("keys.downloadKeyFromCloud", workspaceId, keyId, passphrase),
  deleteKeyFromCloud: (workspaceId, keyId) => ipcRenderer.invoke("keys.deleteKeyFromCloud", workspaceId, keyId),
  changeWorkspacePassphrase: (workspaceId, oldPassphrase, newPassphrase) => ipcRenderer.invoke("keys.changeWorkspacePassphrase", workspaceId, oldPassphrase, newPassphrase)
};
contextBridge.exposeInMainWorld("keysApi", keysApi);
const aiApi = {
  complete: (input) => ipcRenderer.invoke("ai.complete", input),
  translateCommand: (input) => ipcRenderer.invoke("ai.translateCommand", input),
  onChunk: (callback) => {
    const listener = (_event, requestId, chunk) => callback(requestId, chunk);
    ipcRenderer.on("ai:chunk", listener);
    return () => void ipcRenderer.removeListener("ai:chunk", listener);
  },
  onDone: (callback) => {
    const listener = (_event, requestId) => callback(requestId);
    ipcRenderer.on("ai:done", listener);
    return () => void ipcRenderer.removeListener("ai:done", listener);
  },
  onError: (callback) => {
    const listener = (_event, requestId, error) => callback(requestId, error);
    ipcRenderer.on("ai:error", listener);
    return () => void ipcRenderer.removeListener("ai:error", listener);
  }
};
contextBridge.exposeInMainWorld("aiApi", aiApi);
const settingsApi = {
  get: () => ipcRenderer.invoke("settings.get"),
  update: (input) => ipcRenderer.invoke("settings.update", input)
};
contextBridge.exposeInMainWorld("settingsApi", settingsApi);
const apiKeysApi = {
  get: (provider) => ipcRenderer.invoke("apiKeys.get", provider),
  set: (provider, key) => ipcRenderer.invoke("apiKeys.set", provider, key),
  delete: (provider) => ipcRenderer.invoke("apiKeys.delete", provider)
};
contextBridge.exposeInMainWorld("apiKeysApi", apiKeysApi);
