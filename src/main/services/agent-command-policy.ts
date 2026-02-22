import type { AgentRiskLevel, HostFacts } from '../../shared/types/agent';

const DESTRUCTIVE_PATTERNS: RegExp[] = [
  /\brm\s+-rf\b/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bpoweroff\b/i,
  /\buserdel\b/i,
  /\bgroupdel\b/i,
  /\biptables\b/i,
  /\bnft\b/i,
  /\bchmod\s+777\b/i,
];

const PRIVILEGED_PATTERNS: RegExp[] = [
  /\bapt(-get)?\s+(install|remove|upgrade|update)\b/i,
  /\bdnf\s+(install|remove|upgrade|update)\b/i,
  /\byum\s+(install|remove|upgrade|update)\b/i,
  /\bpacman\s+-S\b/i,
  /\bzypper\s+(install|remove|update|upgrade)\b/i,
  /\bapk\s+(add|del|upgrade|update)\b/i,
  /\bsystemctl\b/i,
  /\bservice\b/i,
  /\btee\s+\/etc\//i,
  /\bcp\b.*\s\/etc\//i,
];

function isDestructive(command: string): boolean {
  return DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(command));
}

function needsPrivilege(command: string, facts?: HostFacts): boolean {
  if (facts?.isRoot) return false;
  const alreadyElevated = /^\s*sudo\b/i.test(command) || /^\s*su\b/i.test(command);
  if (alreadyElevated) return false;
  return PRIVILEGED_PATTERNS.some((pattern) => pattern.test(command));
}

export function classifyCommandRisk(command: string, facts?: HostFacts): AgentRiskLevel {
  if (!command.trim()) return 'unknown';
  if (isDestructive(command)) return 'destructive';
  if (needsPrivilege(command, facts)) return 'needs_privilege';
  return 'safe';
}

export function requiresDoubleConfirm(risk: AgentRiskLevel): boolean {
  return risk === 'destructive';
}

export function applyElevation(command: string, shouldElevate: boolean, facts?: HostFacts): string {
  if (!shouldElevate) return command;
  if (facts?.isRoot) return command;
  if (/^\s*sudo\b/i.test(command) || /^\s*su\b/i.test(command)) return command;
  return `sudo ${command}`;
}
