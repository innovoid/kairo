import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ChatMessage } from '../ChatMessage';

describe('ChatMessage', () => {
  const mockOnInsertCommand = vi.fn();

  beforeEach(() => {
    mockOnInsertCommand.mockClear();
    // Mock clipboard API using defineProperty (navigator.clipboard is read-only in jsdom)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  describe('User Messages', () => {
    it('should render user message content', () => {
      render(
        <ChatMessage
          role="user"
          content="How do I list files?"
          timestamp="2024-01-01T00:00:00.000Z"
        />
      );
      expect(screen.getByText('How do I list files?')).toBeInTheDocument();
    });

    it('should align user messages to the right', () => {
      const { container } = render(
        <ChatMessage
          role="user"
          content="Test message"
          timestamp="2024-01-01T00:00:00.000Z"
        />
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('justify-end');
    });
  });

  describe('Assistant Messages', () => {
    it('should render assistant message content', () => {
      render(
        <ChatMessage
          role="assistant"
          content="Use the ls command"
          timestamp="2024-01-01T00:00:00.000Z"
        />
      );
      expect(screen.getByText('Use the ls command')).toBeInTheDocument();
    });

    it('should render empty assistant message as a streaming cursor', () => {
      const { container } = render(
        <ChatMessage
          role="assistant"
          content=""
          timestamp="2024-01-01T00:00:00.000Z"
        />
      );
      // Should show a pulsing element, not plain text
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });

  describe('Fenced code block rendering', () => {
    it('should render a shell code block with copy button', () => {
      render(
        <ChatMessage
          role="assistant"
          content={"Use this:\n```bash\nls -la\n```"}
          timestamp="2024-01-01T00:00:00.000Z"
          onInsertCommand={mockOnInsertCommand}
        />
      );
      expect(screen.getByText('ls -la')).toBeInTheDocument();
      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    it('should render an Insert button for shell code blocks when onInsertCommand is provided', () => {
      render(
        <ChatMessage
          role="assistant"
          content={"```bash\necho hello\n```"}
          timestamp="2024-01-01T00:00:00.000Z"
          onInsertCommand={mockOnInsertCommand}
        />
      );
      expect(screen.getByText('Insert')).toBeInTheDocument();
    });

    it('should call onInsertCommand when Insert is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ChatMessage
          role="assistant"
          content={"```bash\necho hello\n```"}
          timestamp="2024-01-01T00:00:00.000Z"
          onInsertCommand={mockOnInsertCommand}
        />
      );
      await user.click(screen.getByText('Insert'));
      expect(mockOnInsertCommand).toHaveBeenCalledWith('echo hello');
    });

    it('should NOT render an Insert button when onInsertCommand is not provided', () => {
      render(
        <ChatMessage
          role="assistant"
          content={"```bash\necho hello\n```"}
          timestamp="2024-01-01T00:00:00.000Z"
        />
      );
      expect(screen.queryByText('Insert')).not.toBeInTheDocument();
    });
  });

  describe('Inline text rendering', () => {
    it('should render plain text content', () => {
      render(
        <ChatMessage
          role="assistant"
          content="Hello world"
          timestamp="2024-01-01T00:00:00.000Z"
        />
      );
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('should render inline code with backticks', () => {
      render(
        <ChatMessage
          role="assistant"
          content="Run `ls -la` to list files"
          timestamp="2024-01-01T00:00:00.000Z"
        />
      );
      expect(screen.getByText('ls -la')).toBeInTheDocument();
    });
  });
});
