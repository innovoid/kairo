const activeMarkersBySession = new Map<string, Set<string>>();
const partialBySession = new Map<string, string>();

function getOrCreateMarkerSet(sessionId: string): Set<string> {
  const existing = activeMarkersBySession.get(sessionId);
  if (existing) return existing;
  const created = new Set<string>();
  activeMarkersBySession.set(sessionId, created);
  return created;
}

export function registerAgentMarker(sessionId: string, marker: string): void {
  getOrCreateMarkerSet(sessionId).add(marker);
}

export function unregisterAgentMarker(sessionId: string, marker: string): void {
  const markers = activeMarkersBySession.get(sessionId);
  if (!markers) return;
  markers.delete(marker);
  if (markers.size === 0) {
    activeMarkersBySession.delete(sessionId);
  }
}

export function clearAgentVisibilitySession(sessionId: string): void {
  activeMarkersBySession.delete(sessionId);
  partialBySession.delete(sessionId);
}

export function filterAgentArtifactsForRenderer(sessionId: string, chunk: string): string {
  const markers = activeMarkersBySession.get(sessionId);
  if (!chunk) return chunk;

  if (!markers || markers.size === 0) {
    // No agent commands in flight — pass through normally.
    // Discard any stale empty partial buffer left over from agent mode.
    partialBySession.delete(sessionId);
    return chunk;
  }

  // While any agent marker is active, suppress ALL output for this session.
  // This hides both the echoed command text and the command output from the
  // terminal so only the agent UI shows progress — not the raw PTY stream.
  // The sessionEventBus still receives the unfiltered data for the agent to parse.
  return '';
}

