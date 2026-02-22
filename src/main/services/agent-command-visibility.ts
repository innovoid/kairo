const activeMarkersBySession = new Map<string, Set<string>>();
const partialBySession = new Map<string, string>();

function getOrCreateMarkerSet(sessionId: string): Set<string> {
  const existing = activeMarkersBySession.get(sessionId);
  if (existing) return existing;
  const created = new Set<string>();
  activeMarkersBySession.set(sessionId, created);
  return created;
}

function shouldHideLine(line: string, markers: Set<string>): boolean {
  if (!line) return false;

  // Hide wrapper artifacts emitted by session-command-executor.
  if (line.includes('__ARCHTERM_AGENT_EXIT_')) return true;
  if (line.includes('__archterm_status=$?')) return true;
  if (/^\{\s.*;\s\}\s;/.test(line.trim())) return true;

  for (const marker of markers) {
    if (line.includes(`${marker}:`)) {
      return true;
    }
    if (line.includes('__archterm_status=$?') && line.includes(marker)) {
      return true;
    }
  }
  return false;
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
    const pending = partialBySession.get(sessionId);
    if (pending) {
      partialBySession.delete(sessionId);
      return pending + chunk;
    }
    return chunk;
  }

  const pending = partialBySession.get(sessionId) ?? '';
  const combined = pending + chunk;
  const lines = combined.split('\n');
  const tail = lines.pop() ?? '';
  partialBySession.delete(sessionId);

  let filtered = '';
  for (const line of lines) {
    if (shouldHideLine(line, markers)) continue;
    filtered += `${line}\n`;
  }

  if (tail) {
    if (shouldHideLine(tail, markers)) {
      partialBySession.set(sessionId, tail);
    } else {
      filtered += tail;
    }
  }
  return filtered;
}
