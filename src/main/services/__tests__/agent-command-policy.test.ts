import { describe, expect, it } from 'vitest';
import {
  applyElevation,
  classifyCommandRisk,
  requiresDoubleConfirm,
} from '../agent-command-policy';
import type { HostFacts } from '../../../shared/types/agent';

const baseFacts: HostFacts = {
  os: 'Linux',
  distro: 'ubuntu',
  version: '22.04',
  packageManager: 'apt',
  isRoot: false,
  sudoAvailable: true,
  systemdAvailable: true,
  updatedAt: new Date().toISOString(),
};

describe('agent-command-policy', () => {
  it('classifies destructive commands correctly', () => {
    expect(classifyCommandRisk('rm -rf /tmp/test', baseFacts)).toBe('destructive');
    expect(classifyCommandRisk('rm --recursive --force /tmp/test', baseFacts)).toBe('destructive');
    expect(classifyCommandRisk('sudo rm --force --recursive /tmp/test', baseFacts)).toBe('destructive');
    expect(requiresDoubleConfirm('destructive')).toBe(true);
  });

  it('classifies privileged commands correctly', () => {
    expect(classifyCommandRisk('apt-get install -y docker.io', baseFacts)).toBe('needs_privilege');
    expect(classifyCommandRisk('sudo apt-get install -y docker.io', baseFacts)).toBe('safe');
  });

  it('classifies simple safe commands correctly', () => {
    expect(classifyCommandRisk('docker --version', baseFacts)).toBe('safe');
  });

  it('prepends sudo only when required', () => {
    expect(applyElevation('apt-get update', true, baseFacts)).toBe("sudo -- sh -lc 'apt-get update'");
    expect(applyElevation('sudo apt-get update', true, baseFacts)).toBe('sudo apt-get update');
    expect(applyElevation('apt-get update', false, baseFacts)).toBe('apt-get update');
  });
});
