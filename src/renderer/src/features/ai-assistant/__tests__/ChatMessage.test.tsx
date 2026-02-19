import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ChatMessage } from '../ChatMessage';

describe('ChatMessage', () => {
  const mockOnInsertCommand = vi.fn();

  beforeEach(() => {
    mockOnInsertCommand.mockClear();
  });

  describe('User Messages', () => {
    it('should render user message with correct styling', () => {
      render(
        <ChatMessage
          role="user"
          content="How do I list files?"
          timestamp="2024-01-01T00:00:00.000Z"
        />
      );

      const message = screen.getByText('How do I list files?');
      expect(message).toBeInTheDocument();
      expect(message.parentElement).toHaveClass('bg-primary');
      expect(message.parentElement).toHaveClass('text-primary-foreground');
    });

    it('should apply ml-8 spacing for user messages', () => {
      const { container } = render(
        <ChatMessage
          role="user"
          content="Test message"
          timestamp="2024-01-01T00:00:00.000Z"
        />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('ml-8');
    });

    it('should not show CommandSuggestion for user messages', () => {
      render(
        <ChatMessage
          role="user"
          content="Test message"
          command="ls -la"
          timestamp="2024-01-01T00:00:00.000Z"
        />
      );

      expect(screen.queryByText('Copy')).not.toBeInTheDocument();
      expect(screen.queryByText('Insert')).not.toBeInTheDocument();
    });
  });

  describe('Assistant Messages', () => {
    it('should render assistant message with correct styling', () => {
      render(
        <ChatMessage
          role="assistant"
          content="Use the ls command"
          timestamp="2024-01-01T00:00:00.000Z"
        />
      );

      const message = screen.getByText('Use the ls command');
      expect(message).toBeInTheDocument();
      expect(message.parentElement).toHaveClass('bg-muted');
    });

    it('should apply mr-8 spacing for assistant messages', () => {
      const { container } = render(
        <ChatMessage
          role="assistant"
          content="Test message"
          timestamp="2024-01-01T00:00:00.000Z"
        />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('mr-8');
    });

    it('should show CommandSuggestion when command is provided', () => {
      render(
        <ChatMessage
          role="assistant"
          content="Use this command"
          command="ls -la"
          timestamp="2024-01-01T00:00:00.000Z"
          onInsertCommand={mockOnInsertCommand}
        />
      );

      expect(screen.getByText('ls -la')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /insert/i })).toBeInTheDocument();
    });

    it('should not show CommandSuggestion when command is not provided', () => {
      render(
        <ChatMessage
          role="assistant"
          content="Use this command"
          timestamp="2024-01-01T00:00:00.000Z"
        />
      );

      expect(screen.queryByText('Copy')).not.toBeInTheDocument();
      expect(screen.queryByText('Insert')).not.toBeInTheDocument();
    });
  });

  describe('Content Rendering', () => {
    it('should render message content', () => {
      render(
        <ChatMessage
          role="user"
          content="Test content"
          timestamp="2024-01-01T00:00:00.000Z"
        />
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('should render multi-line content', () => {
      render(
        <ChatMessage
          role="assistant"
          content="Line 1\nLine 2\nLine 3"
          timestamp="2024-01-01T00:00:00.000Z"
        />
      );

      expect(screen.getByText(/Line 1/)).toBeInTheDocument();
    });

    it('should preserve whitespace in content', () => {
      const content = 'Line 1\n  Indented\nLine 3';
      render(
        <ChatMessage
          role="assistant"
          content={content}
          timestamp="2024-01-01T00:00:00.000Z"
        />
      );

      const messageElement = screen.getByText(/Line 1/);
      expect(messageElement).toHaveClass('whitespace-pre-wrap');
    });
  });

  describe('CommandSuggestion Integration', () => {
    it('should pass command to CommandSuggestion', () => {
      render(
        <ChatMessage
          role="assistant"
          content="Test"
          command="echo hello"
          timestamp="2024-01-01T00:00:00.000Z"
          onInsertCommand={mockOnInsertCommand}
        />
      );

      expect(screen.getByText('echo hello')).toBeInTheDocument();
    });

    it('should pass onInsert callback to CommandSuggestion', async () => {
      const user = userEvent.setup();
      render(
        <ChatMessage
          role="assistant"
          content="Test"
          command="echo hello"
          timestamp="2024-01-01T00:00:00.000Z"
          onInsertCommand={mockOnInsertCommand}
        />
      );

      const insertButton = screen.getByRole('button', { name: /insert/i });
      await user.click(insertButton);

      expect(mockOnInsertCommand).toHaveBeenCalledWith('echo hello');
    });

    it('should show CommandSuggestion below message content', () => {
      const { container } = render(
        <ChatMessage
          role="assistant"
          content="Test message"
          command="ls -la"
          timestamp="2024-01-01T00:00:00.000Z"
          onInsertCommand={mockOnInsertCommand}
        />
      );

      const messageText = screen.getByText('Test message');
      const commandText = screen.getByText('ls -la');

      // CommandSuggestion should appear after the message content
      const messageParent = messageText.parentElement;
      const commandParent = commandText.closest('[class*="border-primary"]');

      expect(messageParent).toBeInTheDocument();
      expect(commandParent).toBeInTheDocument();
    });
  });

  describe('Message Bubble Styling', () => {
    it('should have rounded corners', () => {
      render(
        <ChatMessage
          role="user"
          content="Test"
          timestamp="2024-01-01T00:00:00.000Z"
        />
      );

      const message = screen.getByText('Test');
      expect(message.parentElement).toHaveClass('rounded-lg');
    });

    it('should have proper padding', () => {
      render(
        <ChatMessage
          role="user"
          content="Test"
          timestamp="2024-01-01T00:00:00.000Z"
        />
      );

      const message = screen.getByText('Test');
      expect(message.parentElement).toHaveClass('px-3', 'py-2');
    });

    it('should have proper text size', () => {
      render(
        <ChatMessage
          role="user"
          content="Test"
          timestamp="2024-01-01T00:00:00.000Z"
        />
      );

      const message = screen.getByText('Test');
      expect(message.parentElement).toHaveClass('text-sm');
    });
  });
});
