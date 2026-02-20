import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAiStore, MODELS_BY_PROVIDER } from '../ai-store';
import type { AiMessage } from '@shared/types/ai';

// Mock the settings store
vi.mock('../settings-store', () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({
      settings: {
        aiProvider: 'openai',
      },
    })),
  },
}));

// Mock window.aiApi and window.apiKeysApi
const mockAiApi = {
  complete: vi.fn(),
  onChunk: vi.fn(() => vi.fn()),
  onDone: vi.fn(() => vi.fn()),
  onError: vi.fn(() => vi.fn()),
};

const mockApiKeysApi = {
  get: vi.fn((_provider?: string): Promise<string | null> => Promise.resolve('test-api-key')),
  set: vi.fn(() => Promise.resolve()),
  delete: vi.fn(() => Promise.resolve()),
};

(global as any).window = {
  aiApi: mockAiApi,
  apiKeysApi: mockApiKeysApi,
};

describe('useAiStore', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Re-set default mock implementations after reset clears them
    mockApiKeysApi.get.mockResolvedValue('test-api-key');
    // Reset store state
    useAiStore.setState({
      messages: [],
      isStreaming: false,
      isOpen: false,
      model: 'gpt-4o-mini',
    });
  });

  describe('Initial State', () => {
    it('should initialize with empty messages array', () => {
      const state = useAiStore.getState();
      expect(state.messages).toEqual([]);
    });

    it('should initialize with isStreaming set to false', () => {
      const state = useAiStore.getState();
      expect(state.isStreaming).toBe(false);
    });

    it('should initialize with default model', () => {
      const state = useAiStore.getState();
      expect(state.model).toBe('gpt-4o-mini');
    });

    it('should initialize with isOpen set to false', () => {
      const state = useAiStore.getState();
      expect(state.isOpen).toBe(false);
    });
  });

  describe('setModel', () => {
    it('should update the model', () => {
      const { setModel } = useAiStore.getState();
      setModel('gpt-4o');

      const state = useAiStore.getState();
      expect(state.model).toBe('gpt-4o');
    });
  });

  describe('setOpen', () => {
    it('should update the isOpen state', () => {
      const { setOpen } = useAiStore.getState();
      setOpen(true);

      const state = useAiStore.getState();
      expect(state.isOpen).toBe(true);
    });

    it('should toggle isOpen state', () => {
      const { setOpen } = useAiStore.getState();

      setOpen(true);
      expect(useAiStore.getState().isOpen).toBe(true);

      setOpen(false);
      expect(useAiStore.getState().isOpen).toBe(false);
    });
  });

  describe('sendMessage', () => {
    it('should add user message to messages array', async () => {
      const { sendMessage } = useAiStore.getState();

      await sendMessage('Hello AI');

      const state = useAiStore.getState();
      const userMessage = state.messages.find(m => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage?.content).toBe('Hello AI');
    });

    it('should create an assistant message placeholder', async () => {
      const { sendMessage } = useAiStore.getState();

      await sendMessage('Hello AI');

      const state = useAiStore.getState();
      const assistantMessage = state.messages.find(m => m.role === 'assistant');
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage?.content).toBe('');
    });

    it('should set isStreaming to true when sending message', async () => {
      const { sendMessage } = useAiStore.getState();

      await sendMessage('Hello AI');

      const state = useAiStore.getState();
      expect(state.isStreaming).toBe(true);
    });

    it('should call window.aiApi.complete with correct parameters', async () => {
      const { sendMessage } = useAiStore.getState();

      await sendMessage('Hello AI');

      expect(mockAiApi.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openai',
          apiKey: 'test-api-key',
          model: 'gpt-4o-mini',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: 'Hello AI',
            }),
          ]),
          requestId: expect.any(String),
        })
      );
    });

    it('should add error message when API key is not configured', async () => {
      mockApiKeysApi.get.mockResolvedValue(null);

      const { sendMessage } = useAiStore.getState();

      await sendMessage('Hello AI');

      const state = useAiStore.getState();
      const errorMessage = state.messages.find(m =>
        m.role === 'assistant' && m.content.includes('No API key configured')
      );
      expect(errorMessage).toBeDefined();
      expect(mockAiApi.complete).not.toHaveBeenCalled();
    });

    it('should handle API key load error gracefully', async () => {
      mockApiKeysApi.get.mockRejectedValue(new Error('IPC error'));
      const { sendMessage } = useAiStore.getState();
      await sendMessage('Hello AI');
      const state = useAiStore.getState();
      expect(state.isStreaming).toBe(false);
      expect(state.messages.some(m => m.role === 'assistant' && m.content.includes('Failed'))).toBe(true);
    });

    it('should use correct API key for different providers', async () => {
      const { useSettingsStore } = await import('../settings-store');

      // Test Anthropic
      vi.mocked(useSettingsStore.getState).mockReturnValue({
        settings: {
          aiProvider: 'anthropic',
        },
      } as any);
      mockApiKeysApi.get.mockResolvedValue('anthropic-key');

      const { sendMessage } = useAiStore.getState();

      await sendMessage('Hello AI');

      expect(mockAiApi.complete).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'anthropic',
          apiKey: 'anthropic-key',
        })
      );
    });
  });

  describe('appendChunk', () => {
    it('should append text chunk to the correct message', async () => {
      const { sendMessage, appendChunk } = useAiStore.getState();

      // First send a message to create messages
      await sendMessage('Hello AI');

      const state = useAiStore.getState();
      const assistantMessage = state.messages.find(m => m.role === 'assistant');
      const requestId = assistantMessage!.id;

      // Now append chunk
      appendChunk(requestId, 'Hello ');

      let message = useAiStore.getState().messages.find(m => m.id === requestId);
      expect(message?.content).toBe('Hello ');

      // Append another chunk
      appendChunk(requestId, 'World!');

      message = useAiStore.getState().messages.find(m => m.id === requestId);
      expect(message?.content).toBe('Hello World!');
    });

    it('should not modify other messages when appending chunks', async () => {
      const { sendMessage, appendChunk } = useAiStore.getState();

      // Send first message
      await sendMessage('First message');

      let state = useAiStore.getState();
      const firstAssistantMessage = state.messages.find(m => m.role === 'assistant');
      const firstRequestId = firstAssistantMessage!.id;

      appendChunk(firstRequestId, 'First response');

      // Send second message
      await sendMessage('Second message');

      state = useAiStore.getState();
      const secondAssistantMessage = state.messages
        .filter(m => m.role === 'assistant')
        .find(m => m.id !== firstRequestId);
      const secondRequestId = secondAssistantMessage!.id;

      appendChunk(secondRequestId, 'Second response');

      // Verify first message unchanged
      const firstMessage = useAiStore.getState().messages.find(m => m.id === firstRequestId);
      expect(firstMessage?.content).toBe('First response');

      // Verify second message updated
      const secondMessage = useAiStore.getState().messages.find(m => m.id === secondRequestId);
      expect(secondMessage?.content).toBe('Second response');
    });
  });

  describe('finishStreaming', () => {
    it('should set isStreaming to false', async () => {
      const { sendMessage, finishStreaming } = useAiStore.getState();

      await sendMessage('Hello AI');

      expect(useAiStore.getState().isStreaming).toBe(true);

      finishStreaming('request-id');

      expect(useAiStore.getState().isStreaming).toBe(false);
    });
  });

  describe('clearHistory', () => {
    it('should clear all messages', async () => {
      const { sendMessage, clearHistory } = useAiStore.getState();

      await sendMessage('Hello AI');

      expect(useAiStore.getState().messages.length).toBeGreaterThan(0);

      clearHistory();

      expect(useAiStore.getState().messages).toEqual([]);
    });

    it('should reset isStreaming to false', async () => {
      const { sendMessage, clearHistory } = useAiStore.getState();

      await sendMessage('Hello AI');

      expect(useAiStore.getState().isStreaming).toBe(true);

      clearHistory();

      expect(useAiStore.getState().isStreaming).toBe(false);
    });
  });

  describe('Message Interface', () => {
    it('should create messages with required properties', async () => {
      const { sendMessage } = useAiStore.getState();

      await sendMessage('Test message');

      const state = useAiStore.getState();
      const message = state.messages[0];
      expect(message).toHaveProperty('id');
      expect(message).toHaveProperty('role');
      expect(message).toHaveProperty('content');
      expect(message).toHaveProperty('createdAt');
    });

    it('should create messages with valid timestamp', async () => {
      const { sendMessage } = useAiStore.getState();

      await sendMessage('Test message');

      const state = useAiStore.getState();
      const message = state.messages[0];
      expect(message.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(new Date(message.createdAt).toString()).not.toBe('Invalid Date');
    });
  });

  describe('MODELS_BY_PROVIDER', () => {
    it('should export model options for all providers', () => {
      expect(MODELS_BY_PROVIDER).toHaveProperty('openai');
      expect(MODELS_BY_PROVIDER).toHaveProperty('anthropic');
      expect(MODELS_BY_PROVIDER).toHaveProperty('gemini');
    });

    it('should have valid model structures', () => {
      for (const [provider, models] of Object.entries(MODELS_BY_PROVIDER)) {
        expect(Array.isArray(models)).toBe(true);
        expect(models.length).toBeGreaterThan(0);

        for (const model of models) {
          expect(model).toHaveProperty('value');
          expect(model).toHaveProperty('label');
          expect(typeof model.value).toBe('string');
          expect(typeof model.label).toBe('string');
        }
      }
    });
  });
});
