import type { IpcMainInvokeEvent } from 'electron';
import { agentOrchestrator } from '../services/agent-orchestrator';
import type {
  AgentChatInput,
  ApproveAgentStepInput,
  CancelAgentRunInput,
  RejectAgentStepInput,
  RunPlaybookInput,
  SavePlaybookInput,
  StartAgentRunInput,
} from '../../shared/types/agent';

export const agentIpcHandlers = {
  async startRun(event: IpcMainInvokeEvent, input: StartAgentRunInput) {
    return agentOrchestrator.startRun(input, event.sender);
  },

  async approveStep(event: IpcMainInvokeEvent, input: ApproveAgentStepInput) {
    return agentOrchestrator.approveStep(input, event.sender);
  },

  async rejectStep(event: IpcMainInvokeEvent, input: RejectAgentStepInput) {
    return agentOrchestrator.rejectStep(input.runId, input.stepId, input.reason, event.sender);
  },

  async cancelRun(event: IpcMainInvokeEvent, input: CancelAgentRunInput) {
    return agentOrchestrator.cancelRun(input.runId, event.sender);
  },

  async chat(event: IpcMainInvokeEvent, input: AgentChatInput) {
    return agentOrchestrator.chat(input, event.sender);
  },

  async getRun(_event: IpcMainInvokeEvent, runId: string) {
    return agentOrchestrator.getRun(runId);
  },

  async listRuns(_event: IpcMainInvokeEvent, sessionId?: string) {
    return agentOrchestrator.listRuns(sessionId);
  },

  async runPlaybook(event: IpcMainInvokeEvent, input: RunPlaybookInput) {
    return agentOrchestrator.runPlaybook(input, event.sender);
  },

  async savePlaybook(_event: IpcMainInvokeEvent, input: SavePlaybookInput) {
    return agentOrchestrator.savePlaybook(input);
  },

  async listPlaybooks(_event: IpcMainInvokeEvent, workspaceId?: string) {
    return agentOrchestrator.listPlaybooks(workspaceId);
  },
};
