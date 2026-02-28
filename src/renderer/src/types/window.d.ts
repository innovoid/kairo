import type { AuthApi } from '../../../preload/auth-api';
import type { WorkspaceApi } from '../../../preload/workspace-api';
import type { HostsApi, FoldersApi } from '../../../preload/hosts-api';
import type { SshApi } from '../../../preload/ssh-api';
import type { SftpApi } from '../../../preload/sftp-api';
import type { KeysApi } from '../../../preload/keys-api';
import type { AiApi } from '../../../preload/ai-api';
import type { AgentApi } from '../../../preload/agent-api';
import type { SettingsApi } from '../../../preload/settings-api';
import type { ApiKeysApi } from '../../../preload/api-keys-api';
import type { SnippetsApi } from '../../../preload/snippets-api';
import type { RecordingApi } from '../../../preload/recording-api';
import type { UpdaterApi } from '../../../preload/updater-api';
import type { ActiveWorkspaceContext, Workspace } from '../../../shared/types/workspace';

declare global {
  interface Window {
    authApi: AuthApi;
    workspaceApi: WorkspaceApi & {
      getActiveContext: () => Promise<ActiveWorkspaceContext | null>;
      ensurePersonalWorkspace: (name?: string) => Promise<Workspace>;
    };
    hostsApi: HostsApi;
    foldersApi: FoldersApi;
    sshApi: SshApi;
    sftpApi: SftpApi;
    keysApi: KeysApi;
    aiApi: AiApi;
    agentApi: AgentApi;
    settingsApi: SettingsApi;
    apiKeysApi: ApiKeysApi;
    snippetsApi: SnippetsApi;
    recordingApi: RecordingApi;
    updaterApi: UpdaterApi;
  }
}
