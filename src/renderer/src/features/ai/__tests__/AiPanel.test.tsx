import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiPanel } from '../AiPanel';

// Create mock functions that will be used in the mock
let mockSendMessage: ReturnType<typeof vi.fn>;
let mockAppendChunk: ReturnType<typeof vi.fn>;
let mockFinishStreaming: ReturnType<typeof vi.fn>;
let mockClearHistory: ReturnType<typeof vi.fn>;
let mockSetOpen: ReturnType<typeof vi.fn>;
let mockSetModel: ReturnType<typeof vi.fn>;
let mockUseAiStore: ReturnType<typeof vi.fn>;

vi.mock('@/stores/ai-store', () => {
  const mockFn = vi.fn();
  return {
    useAiStore: mockFn,
    get default() {
      return mockFn;
    },
    MODELS_BY_PROVIDER: {
      openai: [
        { value: 'gpt-4o', label: 'GPT-4o' },
        { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
      ],
      anthropic: [
        { value: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
      ],
      gemini: [
        { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      ],
    },
  };
});

// Mock window.aiApi
const mockAiApi = {
  complete: vi.fn(),
  onChunk: vi.fn(() => vi.fn()),
  onDone: vi.fn(() => vi.fn()),
  onError: vi.fn(() => vi.fn()),
};

// Mock ChatMessage component
vi.mock('../ChatMessage', () => ({
  ChatMessage: ({ message }: { message: any }) => (
    <div data-testid={`message-${message.role}`}>
      <span>{message.role}</span>: <span>{message.content}</span>
    </div>
  ),
}));

// Mock ModelSelector component
vi.mock('../ProviderSelector', () => ({
  ModelSelector: () => <div data-testid="model-selector">Model Selector</div>,
}));

// Mock CommandSuggestion component
vi.mock('../CommandSuggestion', () => ({
  CommandSuggestion: () => <div data-testid="command-suggestion">Command Suggestion</div>,
}));

describe('AiPanel', () => {
  beforeEach(async () => {
    // Initialize mocks
    mockSendMessage = vi.fn();
    mockAppendChunk = vi.fn();
    mockFinishStreaming = vi.fn();
    mockClearHistory = vi.fn();
    mockSetOpen = vi.fn();
    mockSetModel = vi.fn();

    (window as any).aiApi = mockAiApi;

    // Import and set default mock return value
    const { useAiStore } = await import('@/stores/ai-store');
    mockUseAiStore = vi.mocked(useAiStore);
    mockUseAiStore.mockReturnValue({
      messages: [],
      isStreaming: false,
      isOpen: false,
      model: 'gpt-4o-mini',
      setModel: mockSetModel,
      setOpen: mockSetOpen,
      sendMessage: mockSendMessage,
      appendChunk: mockAppendChunk,
      finishStreaming: mockFinishStreaming,
      clearHistory: mockClearHistory,
    });
  });

  describe('Panel Closed State', () => {
    it('should render floating button when panel is closed', () => {
      render(<AiPanel />);

      const button = screen.getByRole('button', { name: /open ai assistant/i });
      expect(button).toBeInTheDocument();
    });

    it('should open panel when floating button is clicked', async () => {
      const user = userEvent.setup();
      render(<AiPanel />);

      const button = screen.getByRole('button', { name: /open ai assistant/i });
      await user.click(button);

      expect(mockSetOpen).toHaveBeenCalledWith(true);
    });
  });

  describe('Panel Open State', () => {
    beforeEach(() => {
      mockUseAiStore.mockReturnValue({
        messages: [],
        isStreaming: false,
        isOpen: true,
        model: 'gpt-4o-mini',
        setModel: mockSetModel,
        setOpen: mockSetOpen,
        sendMessage: mockSendMessage,
        appendChunk: mockAppendChunk,
        finishStreaming: mockFinishStreaming,
        clearHistory: mockClearHistory,
      });
    });

    it('should render panel header with title', () => {
      render(<AiPanel />);

      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    });

    it('should render close button', () => {
      render(<AiPanel />);

      const buttons = screen.getAllByRole('button');
      const closeButton = buttons.find(btn =>
        btn.className.includes('h-6 w-6')
      );
      expect(closeButton).toBeInTheDocument();
    });

    it('should close panel when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<AiPanel />);

      const buttons = screen.getAllByRole('button');
      const closeButton = buttons.find(btn =>
        btn.className.includes('h-6 w-6')
      );
      await user.click(closeButton!);

      expect(mockSetOpen).toHaveBeenCalledWith(false);
    });

    it('should render model selector', () => {
      render(<AiPanel />);

      expect(screen.getByTestId('model-selector')).toBeInTheDocument();
    });

    it('should render command suggestion', () => {
      render(<AiPanel />);

      expect(screen.getByTestId('command-suggestion')).toBeInTheDocument();
    });

    it('should render input field', () => {
      render(<AiPanel />);

      const textarea = screen.getByPlaceholderText(/ask anything/i);
      expect(textarea).toBeInTheDocument();
    });

    it('should render send button', () => {
      render(<AiPanel />);

      expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
    });

    it('should render clear history button', () => {
      render(<AiPanel />);

      const clearButton = screen.getByRole('button', { name: /clear history/i });
      expect(clearButton).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    beforeEach(() => {
      mockUseAiStore.mockReturnValue({
        messages: [],
        isStreaming: false,
        isOpen: true,
        model: 'gpt-4o-mini',
        setModel: mockSetModel,
        setOpen: mockSetOpen,
        sendMessage: mockSendMessage,
        appendChunk: mockAppendChunk,
        finishStreaming: mockFinishStreaming,
        clearHistory: mockClearHistory,
      });
    });

    it('should show empty state when no messages', () => {
      render(<AiPanel />);

      expect(
        screen.getByText(/ask anything about linux commands/i)
      ).toBeInTheDocument();
    });
  });

  describe('Messages Display', () => {
    beforeEach(() => {
      mockUseAiStore.mockReturnValue({
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'Hello AI',
            createdAt: new Date().toISOString(),
          },
          {
            id: '2',
            role: 'assistant',
            content: 'Hello! How can I help you?',
            createdAt: new Date().toISOString(),
          },
        ],
        isStreaming: false,
        isOpen: true,
        model: 'gpt-4o-mini',
        setModel: mockSetModel,
        setOpen: mockSetOpen,
        sendMessage: mockSendMessage,
        appendChunk: mockAppendChunk,
        finishStreaming: mockFinishStreaming,
        clearHistory: mockClearHistory,
      });
    });

    it('should display messages when they exist', () => {
      render(<AiPanel />);

      expect(screen.getByTestId('message-user')).toBeInTheDocument();
      expect(screen.getByTestId('message-assistant')).toBeInTheDocument();
    });

    it('should not show empty state when messages exist', () => {
      render(<AiPanel />);

      expect(
        screen.queryByText(/ask anything about linux commands/i)
      ).not.toBeInTheDocument();
    });

    it('should render messages with correct content', () => {
      render(<AiPanel />);

      expect(screen.getByText('Hello AI')).toBeInTheDocument();
      expect(screen.getByText('Hello! How can I help you?')).toBeInTheDocument();
    });
  });

  describe('Input Handling', () => {
    beforeEach(() => {
      mockUseAiStore.mockReturnValue({
        messages: [],
        isStreaming: false,
        isOpen: true,
        model: 'gpt-4o-mini',
        setModel: mockSetModel,
        setOpen: mockSetOpen,
        sendMessage: mockSendMessage,
        appendChunk: mockAppendChunk,
        finishStreaming: mockFinishStreaming,
        clearHistory: mockClearHistory,
      });
    });

    it('should update input value when typing', async () => {
      const user = userEvent.setup();
      render(<AiPanel />);

      const textarea = screen.getByPlaceholderText(/ask anything/i);
      await user.type(textarea, 'Test message');

      expect(textarea).toHaveValue('Test message');
    });

    it('should call sendMessage when send button is clicked', async () => {
      const user = userEvent.setup();
      render(<AiPanel />);

      const textarea = screen.getByPlaceholderText(/ask anything/i);
      await user.type(textarea, 'Test message');

      const sendButton = screen.getByRole('button', { name: /send/i });
      await user.click(sendButton);

      expect(mockSendMessage).toHaveBeenCalledWith('Test message');
    });

    it('should clear input after sending message', async () => {
      const user = userEvent.setup();
      render(<AiPanel />);

      const textarea = screen.getByPlaceholderText(/ask anything/i);
      await user.type(textarea, 'Test message');

      const sendButton = screen.getByRole('button', { name: /send/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(textarea).toHaveValue('');
      });
    });

    it('should send message on Enter key press', async () => {
      const user = userEvent.setup();
      render(<AiPanel />);

      const textarea = screen.getByPlaceholderText(/ask anything/i);
      await user.type(textarea, 'Test message{Enter}');

      expect(mockSendMessage).toHaveBeenCalledWith('Test message');
    });

    it('should not send message on Shift+Enter', async () => {
      const user = userEvent.setup();
      render(<AiPanel />);

      const textarea = screen.getByPlaceholderText(/ask anything/i);
      await user.type(textarea, 'Test message{Shift>}{Enter}{/Shift}');

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('should not send empty messages', async () => {
      const user = userEvent.setup();
      render(<AiPanel />);

      const sendButton = screen.getByRole('button', { name: /send/i });
      await user.click(sendButton);

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('should not send messages with only whitespace', async () => {
      const user = userEvent.setup();
      render(<AiPanel />);

      const textarea = screen.getByPlaceholderText(/ask anything/i);
      await user.type(textarea, '   ');

      const sendButton = screen.getByRole('button', { name: /send/i });
      await user.click(sendButton);

      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Streaming State', () => {
    beforeEach(() => {
      mockUseAiStore.mockReturnValue({
        messages: [],
        isStreaming: true,
        isOpen: true,
        model: 'gpt-4o-mini',
        setModel: mockSetModel,
        setOpen: mockSetOpen,
        sendMessage: mockSendMessage,
        appendChunk: mockAppendChunk,
        finishStreaming: mockFinishStreaming,
        clearHistory: mockClearHistory,
      });
    });

    it('should disable input when streaming', () => {
      render(<AiPanel />);

      const textarea = screen.getByPlaceholderText(/ask anything/i);
      expect(textarea).toBeDisabled();
    });

    it('should disable send button when streaming', () => {
      render(<AiPanel />);

      const sendButton = screen.getByRole('button', { name: /thinking/i });
      expect(sendButton).toBeDisabled();
    });

    it('should show "Thinking..." text on send button when streaming', () => {
      render(<AiPanel />);

      expect(screen.getByRole('button', { name: /thinking/i })).toBeInTheDocument();
    });
  });

  describe('Clear History', () => {
    beforeEach(() => {
      mockUseAiStore.mockReturnValue({
        messages: [
          {
            id: '1',
            role: 'user',
            content: 'Hello',
            createdAt: new Date().toISOString(),
          },
        ],
        isStreaming: false,
        isOpen: true,
        model: 'gpt-4o-mini',
        setModel: mockSetModel,
        setOpen: mockSetOpen,
        sendMessage: mockSendMessage,
        appendChunk: mockAppendChunk,
        finishStreaming: mockFinishStreaming,
        clearHistory: mockClearHistory,
      });
    });

    it('should call clearHistory when clear button is clicked', async () => {
      const user = userEvent.setup();
      render(<AiPanel />);

      const clearButton = screen.getByRole('button', { name: /clear history/i });
      await user.click(clearButton);

      expect(mockClearHistory).toHaveBeenCalled();
    });
  });

  describe('AI Event Listeners', () => {
    beforeEach(() => {
      mockUseAiStore.mockReturnValue({
        messages: [],
        isStreaming: false,
        isOpen: true,
        model: 'gpt-4o-mini',
        setModel: mockSetModel,
        setOpen: mockSetOpen,
        sendMessage: mockSendMessage,
        appendChunk: mockAppendChunk,
        finishStreaming: mockFinishStreaming,
        clearHistory: mockClearHistory,
      });
    });

    it('should register AI event listeners on mount', () => {
      render(<AiPanel />);

      expect(mockAiApi.onChunk).toHaveBeenCalled();
      expect(mockAiApi.onDone).toHaveBeenCalled();
      expect(mockAiApi.onError).toHaveBeenCalled();
    });

    it('should cleanup event listeners on unmount', () => {
      const unsubscribeChunk = vi.fn();
      const unsubscribeDone = vi.fn();
      const unsubscribeError = vi.fn();

      mockAiApi.onChunk.mockReturnValue(unsubscribeChunk);
      mockAiApi.onDone.mockReturnValue(unsubscribeDone);
      mockAiApi.onError.mockReturnValue(unsubscribeError);

      const { unmount } = render(<AiPanel />);
      unmount();

      expect(unsubscribeChunk).toHaveBeenCalled();
      expect(unsubscribeDone).toHaveBeenCalled();
      expect(unsubscribeError).toHaveBeenCalled();
    });
  });

  describe('Send Icon', () => {
    beforeEach(() => {
      mockUseAiStore.mockReturnValue({
        messages: [],
        isStreaming: false,
        isOpen: true,
        model: 'gpt-4o-mini',
        setModel: mockSetModel,
        setOpen: mockSetOpen,
        sendMessage: mockSendMessage,
        appendChunk: mockAppendChunk,
        finishStreaming: mockFinishStreaming,
        clearHistory: mockClearHistory,
      });
    });

    it('should render Send icon from lucide-react', () => {
      const { container } = render(<AiPanel />);

      const sendButton = screen.getByRole('button', { name: /send/i });
      const svg = sendButton.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });
});
