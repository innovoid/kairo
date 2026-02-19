import type { IpcMainInvokeEvent } from 'electron';
import { aiProxy } from '../services/ai-proxy';
import type { AiCompleteInput, AiTranslateInput } from '../../shared/types/ai';

export const aiIpcHandlers = {
  async complete(event: IpcMainInvokeEvent, input: AiCompleteInput): Promise<void> {
    await aiProxy.complete(input, event.sender);
  },

  async translateCommand(event: IpcMainInvokeEvent, input: AiTranslateInput): Promise<void> {
    await aiProxy.translateCommand(input, event.sender);
  },
};
