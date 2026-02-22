import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!(globalThis as any).ResizeObserver) {
  (globalThis as any).ResizeObserver = ResizeObserverMock;
}

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}

if (!navigator.clipboard) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(''),
    },
  });
}

// Cleanup after each test
afterEach(() => {
  cleanup();
});
