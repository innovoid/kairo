const activeMarkersBySession = new Map<string, Set<string>>();
const partialBySession = new Map<string, string>();

function getOrCreateMarkerSet(sessionId: string): Set<string> {
  const existing = activeMarkersBySession.get(sessionId);
  if (existing) return existing;
  const created = new Set<string>();
  activeMarkersBySession.set(sessionId, created);
  return created;
}

function isWrapperEchoLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Primary echoed wrapper line emitted by session-command-executor.
  if (trimmed.includes('__archterm_status=$?')) return true;

  // Fallback for wrapped one-liner command blocks.
  return /^\{\s*.+\s*;\s*\}\s*;\s*$/.test(trimmed);
}

function isWrapperContinuationArtifact(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return trimmed.startsWith('; printf ') && trimmed.includes('__ARCHTERM_AGENT_EXIT_');
}

function isMarkerArtifactLine(line: string, markers: Set<string>): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  for (const marker of markers) {
    if (trimmed === marker || trimmed.startsWith(`${marker}:`)) {
      return true;
    }
  }

  return false;
}

function isPotentialArtifactPartial(partial: string, markers: Set<string>): boolean {
  const trimmed = partial.trimStart();
  if (!trimmed) return false;

  if (trimmed.startsWith('{')) return true;
  if (trimmed.includes('{')) return true;
  if (trimmed.includes('__archterm_status')) return true;
  if (trimmed.includes('__ARCHTERM_AGENT_EXIT_')) return true;
  if (/[#$%]\s+\{/.test(trimmed)) return true;

  for (const marker of markers) {
    if (marker.startsWith(trimmed)) return true;
    if (`${marker}:`.startsWith(trimmed)) return true;
    if (trimmed.startsWith(marker)) return true;
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
    // No agent command in-flight: flush raw stream and clear any stale parser state.
    partialBySession.delete(sessionId);
    return chunk;
  }

  const buffered = `${partialBySession.get(sessionId) ?? ''}${chunk}`.replace(/\r\n/g, '\n');
  const segments = buffered.split('\n');
  const hasTrailingNewline = buffered.endsWith('\n');
  const completeLines = segments.slice(0, Math.max(segments.length - 1, 0));
  const trailingPartial = hasTrailingNewline ? '' : segments[segments.length - 1] ?? '';

  let output = '';
  for (const line of completeLines) {
    if (isWrapperEchoLine(line)) {
      // Preserve the line break so shell cursor movement remains correct
      // even when command-echo text is suppressed.
      output += '\n';
      continue;
    }
    if (isWrapperContinuationArtifact(line)) continue;
    if (isMarkerArtifactLine(line, markers)) continue;
    output += `${line}\n`;
  }

  if (!trailingPartial) {
    partialBySession.delete(sessionId);
    return output;
  }

  if (isPotentialArtifactPartial(trailingPartial, markers)) {
    partialBySession.set(sessionId, trailingPartial);
    return output;
  }

  partialBySession.delete(sessionId);
  return output + trailingPartial;
}
