import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentRun } from '@shared/types/agent';
import { useAgentStore } from '../agent-store';

vi.mock('../settings-store', () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({
      settings: {
        aiProvider: 'openai',
      },
    })),
  },
}));

const sampleRun: AgentRun = {
  id: 'run-1',
  sessionId: 'session-1',
  task: 'Install Docker',
  status: 'awaiting_approval',
  steps: [
    {
      id: 'step-1',
      index: 0,
      title: 'Install package',
      command: 'apt-get install -y docker.io',
      status: 'awaiting_approval',
      risk: 'needs_privilege',
      requiresDoubleConfirm: false,
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockAgentApi = {
  startRun: vi.fn(async () => sampleRun),
  approveStep: vi.fn(),
  rejectStep: vi.fn(),
  cancelRun: vi.fn(),
  getRun: vi.fn(),
  listRuns: vi.fn(),
  runPlaybook: vi.fn(async () => sampleRun),
  savePlaybook: vi.fn(async () => ({ id: 'pb-1', name: 'docker', task: 'Install Docker', steps: [], createdAt: new Date().toISOString() })),
  listPlaybooks: vi.fn(async () => ([{ id: 'pb-1', name: 'docker', task: 'Install Docker', steps: [], createdAt: new Date().toISOString() }])),
  onRunUpdated: vi.fn(() => vi.fn()),
  onStepOutput: vi.fn(() => vi.fn()),
  onBlocked: vi.fn(() => vi.fn()),
  onDone: vi.fn(() => vi.fn()),
  onError: vi.fn(() => vi.fn()),
};

const mockApiKeysApi = {
  get: vi.fn(async () => 'test-api-key'),
};

(global as any).window = {
  agentApi: mockAgentApi,
  apiKeysApi: mockApiKeysApi,
};

describe('useAgentStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAgentStore.setState({
      runs: {},
      activeRunBySession: {},
      stepOutputByStepId: {},
      listenersInitialized: false,
    } as any);
  });

  it('starts run and stores it by session', async () => {
    const run = await useAgentStore.getState().startRun({
      sessionId: 'session-1',
      task: 'Install Docker',
    });

    expect(run.id).toBe('run-1');
    expect(mockAgentApi.startRun).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        task: 'Install Docker',
        provider: 'openai',
        apiKey: 'test-api-key',
      })
    );

    const state = useAgentStore.getState();
    expect(state.activeRunBySession['session-1']).toBe('run-1');
    expect(state.runs['run-1']).toBeDefined();
  });

  it('runs playbook and updates active run mapping', async () => {
    await useAgentStore.getState().runPlaybook({
      playbookName: 'docker',
      sessionId: 'session-1',
    });

    expect(mockAgentApi.runPlaybook).toHaveBeenCalledWith({
      playbookName: 'docker',
      sessionId: 'session-1',
    });

    const state = useAgentStore.getState();
    expect(state.activeRunBySession['session-1']).toBe('run-1');
  });

  it('lists playbooks through agent api', async () => {
    const list = await useAgentStore.getState().listPlaybooks('ws-1');
    expect(mockAgentApi.listPlaybooks).toHaveBeenCalledWith('ws-1');
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('docker');
  });
});
