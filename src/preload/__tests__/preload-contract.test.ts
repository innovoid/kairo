import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWindowApiMocks } from '../../renderer/src/test-utils/window-api-mocks';

const exposeInMainWorld = vi.fn();

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld,
  },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  },
}));

function flattenFunctionPaths(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') return [];

  const entries = Object.entries(value as Record<string, unknown>);
  const paths: string[] = [];

  for (const [key, nestedValue] of entries) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (typeof nestedValue === 'function') {
      paths.push(next);
      continue;
    }
    if (nestedValue && typeof nestedValue === 'object') {
      paths.push(...flattenFunctionPaths(nestedValue, next));
    }
  }

  return paths;
}

describe('preload api contract', () => {
  beforeEach(() => {
    exposeInMainWorld.mockClear();
    vi.resetModules();
  });

  it('keeps window api mocks in sync with what preload exposes', async () => {
    await import('../index');

    const exposedApis = new Map<string, unknown>(
      exposeInMainWorld.mock.calls.map(([name, api]) => [name as string, api])
    );
    const mockedApis = createWindowApiMocks() as Record<string, unknown>;

    expect([...exposedApis.keys()].sort()).toEqual(Object.keys(mockedApis).sort());

    for (const [apiName, mockApi] of Object.entries(mockedApis)) {
      const exposedApi = exposedApis.get(apiName);
      expect(exposedApi).toBeTruthy();

      const exposedMethodPaths = flattenFunctionPaths(exposedApi).sort();
      const mockMethodPaths = flattenFunctionPaths(mockApi).sort();

      expect(mockMethodPaths).toEqual(exposedMethodPaths);
    }
  });
});

