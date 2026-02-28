import { EventEmitter } from 'node:events';

interface SessionEventMap {
  data: [sessionId: string, data: string];
  error: [sessionId: string, error: string];
  closed: [sessionId: string];
  interrupted: [sessionId: string];
}

class SessionEventBus {
  private readonly emitter = new EventEmitter();

  emitData(sessionId: string, data: string): void {
    this.emitter.emit('data', sessionId, data);
  }

  emitError(sessionId: string, error: string): void {
    this.emitter.emit('error', sessionId, error);
  }

  emitClosed(sessionId: string): void {
    this.emitter.emit('closed', sessionId);
  }

  emitInterrupted(sessionId: string): void {
    this.emitter.emit('interrupted', sessionId);
  }

  onData(listener: (...args: SessionEventMap['data']) => void): () => void {
    this.emitter.on('data', listener);
    return () => {
      this.emitter.off('data', listener);
    };
  }

  onError(listener: (...args: SessionEventMap['error']) => void): () => void {
    this.emitter.on('error', listener);
    return () => {
      this.emitter.off('error', listener);
    };
  }

  onClosed(listener: (...args: SessionEventMap['closed']) => void): () => void {
    this.emitter.on('closed', listener);
    return () => {
      this.emitter.off('closed', listener);
    };
  }

  onInterrupted(listener: (...args: SessionEventMap['interrupted']) => void): () => void {
    this.emitter.on('interrupted', listener);
    return () => {
      this.emitter.off('interrupted', listener);
    };
  }
}

export const sessionEventBus = new SessionEventBus();
