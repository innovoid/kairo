import { describe, expect, it } from 'vitest';
import {
  clearAgentVisibilitySession,
  filterAgentArtifactsForRenderer,
  registerAgentMarker,
  unregisterAgentMarker,
} from '../agent-command-visibility';

describe('agent-command-visibility', () => {
  const sessionId = 's-1';
  const marker = '__ARCHTERM_AGENT_EXIT_abc123__';

  it('passes through output when no marker is active', () => {
    const input = 'hello\nworld\n';
    expect(filterAgentArtifactsForRenderer(sessionId, input)).toBe(input);
  });

  it('hides wrapper and marker lines for active markers', () => {
    registerAgentMarker(sessionId, marker);

    const input =
      '{ uname -s ; } ; __archterm_status=$?; printf "\\n__ARCHTERM_AGENT_EXIT_abc123__:%s\\n" "$__archterm_status"\nDarwin\n__ARCHTERM_AGENT_EXIT_abc123__:0\n';

    expect(filterAgentArtifactsForRenderer(sessionId, input)).toBe('Darwin\n');

    unregisterAgentMarker(sessionId, marker);
  });

  it('hides wrapper line even when marker token is wrapped in another line', () => {
    registerAgentMarker(sessionId, marker);

    const input = '{ uname -s ; } ;\nDarwin\n';
    expect(filterAgentArtifactsForRenderer(sessionId, input)).toBe('Darwin\n');

    unregisterAgentMarker(sessionId, marker);
  });

  it('handles split chunks while filtering active marker lines', () => {
    registerAgentMarker(sessionId, marker);

    const first = `Darwin\n${marker}:`;
    const second = '0\n';

    expect(filterAgentArtifactsForRenderer(sessionId, first)).toBe('Darwin\n');
    expect(filterAgentArtifactsForRenderer(sessionId, second)).toBe('');

    unregisterAgentMarker(sessionId, marker);
  });

  it('resets buffers when session is cleared', () => {
    registerAgentMarker(sessionId, marker);
    expect(filterAgentArtifactsForRenderer(sessionId, `${marker}:`)).toBe('');
    clearAgentVisibilitySession(sessionId);

    expect(filterAgentArtifactsForRenderer(sessionId, '0\n')).toBe('0\n');
  });

  it('passes through non-artifact tails while marker is active', () => {
    registerAgentMarker(sessionId, marker);

    expect(filterAgentArtifactsForRenderer(sessionId, 'prompt> ')).toBe('prompt> ');
    unregisterAgentMarker(sessionId, marker);
  });
});
