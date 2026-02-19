import type { AuthApi } from '../../../preload/auth-api';
import type { WorkspaceApi } from '../../../preload/workspace-api';
import type { HostsApi, FoldersApi } from '../../../preload/hosts-api';
import type { SshApi } from '../../../preload/ssh-api';
import type { SftpApi } from '../../../preload/sftp-api';
import type { KeysApi } from '../../../preload/keys-api';
import type { AiApi } from '../../../preload/ai-api';
import type { SettingsApi } from '../../../preload/settings-api';

declare global {
  interface Window {
    authApi: AuthApi;
    workspaceApi: WorkspaceApi & {
      getActiveContext: () => Promise<unknown>;
      ensurePersonalWorkspace: (name?: string) => Promise<unknown>;
    };
    hostsApi: HostsApi;
    foldersApi: FoldersApi;
    sshApi: SshApi;
    sftpApi: SftpApi;
    keysApi: KeysApi;
    aiApi: AiApi;
    settingsApi: SettingsApi;
  }
}
