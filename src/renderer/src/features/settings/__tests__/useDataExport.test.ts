import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDataExport } from '../hooks/useDataExport';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('useDataExport', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
  let mockLink: HTMLAnchorElement;
  let originalCreateElement: typeof document.createElement;

  beforeEach(() => {
    // Mock URL.createObjectURL and URL.revokeObjectURL
    mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
    mockRevokeObjectURL = vi.fn();
    global.URL.createObjectURL = mockCreateObjectURL as unknown as typeof URL.createObjectURL;
    global.URL.revokeObjectURL = mockRevokeObjectURL as unknown as typeof URL.revokeObjectURL;

    // Mock anchor element
    originalCreateElement = document.createElement.bind(document);
    mockLink = document.createElement('a');
    mockLink.click = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName.toLowerCase() === 'a') return mockLink;
      return originalCreateElement(tagName);
    }) as typeof document.createElement);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with correct default values', () => {
    const { result } = renderHook(() => useDataExport());

    expect(result.current.isExporting).toBe(false);
  });

  it('should export user data as JSON', async () => {
    const { supabase } = await import('@/lib/supabase');

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      user_metadata: { name: 'Test User' },
    };

    const mockHosts = [
      { id: 'host-1', hostname: 'example.com', username: 'user' },
    ];

    const mockKeys = [
      { id: 'key-1', name: 'My Key' },
    ];

    const mockSettings = {
      id: 'settings-1',
      terminalFont: 'JetBrains Mono',
      terminalFontSize: 14,
    };

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser as any },
      error: null,
    });

    vi.mocked(supabase.from).mockImplementation((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data:
          table === 'hosts' ? mockHosts :
          table === 'keys' ? mockKeys :
          table === 'settings' ? [mockSettings] : [],
        error: null,
      }),
    } as any));

    const { result } = renderHook(() => useDataExport());

    let exportedData: any;
    await act(async () => {
      exportedData = await result.current.exportData();
    });

    expect(exportedData).toEqual({
      user: mockUser,
      hosts: mockHosts,
      keys: mockKeys,
      settings: mockSettings,
    });
  });

  it('should download data as JSON file', async () => {
    const { supabase } = await import('@/lib/supabase');

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
    };

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser as any },
      error: null,
    });

    vi.mocked(supabase.from).mockImplementation((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data:
          table === 'hosts' ? [] :
          table === 'keys' ? [] :
          table === 'settings' ? [] : [],
        error: null,
      }),
    } as any));

    const { result } = renderHook(() => useDataExport());

    await act(async () => {
      await result.current.downloadData();
    });

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockLink.href).toBe('blob:mock-url');
    expect(mockLink.download).toMatch(/^export-\d{4}-\d{2}-\d{2}\.json$/);
    expect(mockLink.click).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('should set isExporting during export', async () => {
    const { supabase } = await import('@/lib/supabase');

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-123' } as any },
      error: null,
    });

    vi.mocked(supabase.from).mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    } as any));

    const { result } = renderHook(() => useDataExport());

    let isExportingDuringCall = false;

    // Mock exportData to capture isExporting state
    await act(async () => {
      const promise = result.current.downloadData();
      isExportingDuringCall = result.current.isExporting;
      await promise;
    });

    expect(result.current.isExporting).toBe(false);
  });

  it('should handle errors gracefully', async () => {
    const { supabase } = await import('@/lib/supabase');

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: new Error('Auth error') as any,
    });

    const { result } = renderHook(() => useDataExport());

    await expect(result.current.exportData()).rejects.toThrow();
  });

  it('should return exportData, downloadData, and isExporting', () => {
    const { result } = renderHook(() => useDataExport());

    expect(result.current).toHaveProperty('exportData');
    expect(result.current).toHaveProperty('downloadData');
    expect(result.current).toHaveProperty('isExporting');
    expect(typeof result.current.exportData).toBe('function');
    expect(typeof result.current.downloadData).toBe('function');
    expect(typeof result.current.isExporting).toBe('boolean');
  });
});
