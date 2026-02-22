import type { HostFacts } from '../../shared/types/agent';
import { hostFactsQueries } from '../db';
import { executeShellCommand } from './session-command-executor';

const DEFAULT_FACTS_TTL_MS = 6 * 60 * 60 * 1000;

function parseOsRelease(content: string): { distro: string; version: string } {
  const id = content.match(/^ID=(.*)$/m)?.[1]?.replace(/"/g, '').trim() ?? 'unknown';
  const version = content.match(/^VERSION_ID=(.*)$/m)?.[1]?.replace(/"/g, '').trim() ?? 'unknown';
  return { distro: id, version };
}

async function discoverFacts(sessionId: string): Promise<HostFacts> {
  const [unameResult, osReleaseResult, rootResult, sudoResult, pkgResult, systemdResult] =
    await Promise.all([
      executeShellCommand(sessionId, 'uname -s', { timeoutMs: 20_000 }),
      executeShellCommand(sessionId, 'cat /etc/os-release 2>/dev/null || echo ID=unknown', { timeoutMs: 20_000 }),
      executeShellCommand(sessionId, 'id -u', { timeoutMs: 20_000 }),
      executeShellCommand(sessionId, 'command -v sudo >/dev/null 2>&1 && echo 1 || echo 0', { timeoutMs: 20_000 }),
      executeShellCommand(
        sessionId,
        'for pm in apt apt-get dnf yum pacman zypper apk; do command -v "$pm" >/dev/null 2>&1 && echo "$pm" && break; done',
        { timeoutMs: 20_000 }
      ),
      executeShellCommand(sessionId, 'command -v systemctl >/dev/null 2>&1 && echo 1 || echo 0', {
        timeoutMs: 20_000,
      }),
    ]);

  const { distro, version } = parseOsRelease(osReleaseResult.output);

  return {
    os: unameResult.output.trim() || 'Linux',
    distro,
    version,
    packageManager: pkgResult.output.trim() || 'unknown',
    isRoot: rootResult.output.trim() === '0',
    sudoAvailable: sudoResult.output.trim() === '1',
    systemdAvailable: systemdResult.output.trim() === '1',
    updatedAt: new Date().toISOString(),
  };
}

export const agentFactsService = {
  async getOrDiscover(sessionId: string, hostId?: string, ttlMs = DEFAULT_FACTS_TTL_MS): Promise<HostFacts> {
    if (hostId) {
      const cached = hostFactsQueries.get(hostId);
      if (cached) {
        const ageMs = Date.now() - cached.updated_at;
        if (ageMs <= ttlMs) {
          return JSON.parse(cached.facts) as HostFacts;
        }
      }
    }

    const discovered = await discoverFacts(sessionId);

    if (hostId) {
      hostFactsQueries.upsert({
        host_id: hostId,
        facts: JSON.stringify(discovered),
        updated_at: Date.now(),
      });
    }

    return discovered;
  },
};
