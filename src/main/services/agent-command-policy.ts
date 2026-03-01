import type { AgentRiskLevel, HostFacts } from '../../shared/types/agent';

interface Invocation {
  binary: string;
  args: string[];
}

export interface CommandSafetyAssessment {
  risk: AgentRiskLevel;
  blocked: boolean;
  reason?: string;
}

const DESTRUCTIVE_PATTERNS: RegExp[] = [
  /\bmkfs\b/i,
  /\bfdisk\b/i,
  /\bparted\b/i,
  /\bwipefs\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bpoweroff\b/i,
  /\bhalt\b/i,
  /\binit\s+[016]\b/i,
  /\bdrop\s+(database|table|schema)\b/i,
  /\bsgdisk\s+.*-Z\b/i,
  /\biptables\s+(-F|-X|--flush|--delete-chain)\b/i,
  /\bnft\s+flush\b/i,
  /\bufw\s+(reset|disable)\b/i,
  /\bfirewall-cmd\s+.*--remove\b/i,
];

const PRIVILEGED_PATTERNS: RegExp[] = [
  /\bapt(-get)?\s+(install|remove|purge|upgrade|update|dist-upgrade|autoremove)\b/i,
  /\bdnf\s+(install|remove|upgrade|update|autoremove|reinstall)\b/i,
  /\byum\s+(install|remove|upgrade|update|reinstall)\b/i,
  /\bpacman\s+(-S|-R|-U|-D)\b/i,
  /\bzypper\s+(install|remove|update|upgrade|in|rm|up)\b/i,
  /\bapk\s+(add|del|upgrade|update)\b/i,
  /\bbrew\s+(install|uninstall|upgrade)\b/i,
  /\bsystemctl\s+(start|stop|restart|enable|disable|reload|mask|unmask)\b/i,
  /\bservice\s+\S+\s+(start|stop|restart|reload)\b/i,
  /\brc-service\b/i,
  /\brc-update\b/i,
  /\bip\s+(addr|route|link)\s+(add|del|set|flush)\b/i,
  /\bifconfig\b/i,
  /\bnmcli\s+(con|connection|device)\s+(add|del|modify|up|down)\b/i,
  /\buseradd\b/i,
  /\busermod\b/i,
  /\bpasswd\b/i,
  /\bchown\b/i,
  /\bmount\b/i,
  /\bumount\b/i,
  /\bcrontab\s+-[rie]\b/i,
];

const BLOCKED_SEGMENT_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\b(?:curl|wget)\b[^|]*\|\s*(?:bash|sh|zsh|ksh|dash)\b/i,
    reason: 'Piped remote script execution is blocked. Download, inspect, and run scripts explicitly.',
  },
  {
    pattern: /\beval\b/i,
    reason: 'Use of eval is blocked in agent-executed commands.',
  },
  {
    pattern: /(?:^|[^\w])(?:<\(|>\()/,
    reason: 'Process substitution is blocked in agent-executed commands.',
  },
];

const DESTRUCTIVE_BINARIES = new Set([
  'mkfs',
  'fdisk',
  'parted',
  'wipefs',
  'poweroff',
  'halt',
  'userdel',
  'groupdel',
]);

const ALWAYS_PRIVILEGED_BINARIES = new Set([
  'systemctl',
  'service',
  'rc-service',
  'rc-update',
  'modprobe',
  'insmod',
  'rmmod',
  'ifconfig',
  'useradd',
  'usermod',
  'passwd',
  'chown',
  'mount',
  'umount',
]);

const PRIVILEGED_SUBCOMMANDS: Record<string, Set<string>> = {
  apt: new Set(['install', 'remove', 'purge', 'upgrade', 'update', 'dist-upgrade', 'autoremove']),
  'apt-get': new Set(['install', 'remove', 'purge', 'upgrade', 'update', 'dist-upgrade', 'autoremove']),
  dnf: new Set(['install', 'remove', 'upgrade', 'update', 'autoremove', 'reinstall']),
  yum: new Set(['install', 'remove', 'upgrade', 'update', 'reinstall']),
  pacman: new Set(['-s', '-r', '-u', '-d']),
  zypper: new Set(['install', 'remove', 'update', 'upgrade', 'in', 'rm', 'up']),
  apk: new Set(['add', 'del', 'upgrade', 'update']),
  brew: new Set(['install', 'uninstall', 'upgrade']),
  ip: new Set(['add', 'del', 'set', 'flush']),
  nmcli: new Set(['add', 'del', 'modify', 'up', 'down']),
};

const SENSITIVE_PATH_PREFIXES = ['/etc', '/usr', '/lib', '/boot', '/root'];

function splitShellSegments(command: string): string[] {
  const segments: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escaped = false;

  const push = () => {
    const trimmed = current.trim();
    if (trimmed) segments.push(trimmed);
    current = '';
  };

  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];
    const next = command[i + 1];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      current += ch;
      if (quote !== "'") escaped = true;
      continue;
    }

    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }

    if (ch === ';' || ch === '\n') {
      push();
      continue;
    }

    if (ch === '&' && next === '&') {
      push();
      i += 1;
      continue;
    }

    if (ch === '|') {
      push();
      if (next === '|') i += 1;
      continue;
    }

    current += ch;
  }

  push();
  return segments;
}

function tokenizeCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escaped = false;

  const push = () => {
    if (!current) return;
    tokens.push(current);
    current = '';
  };

  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      if (quote === "'") {
        current += ch;
      } else {
        escaped = true;
      }
      continue;
    }

    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }

    if (/\s/.test(ch)) {
      push();
      continue;
    }

    current += ch;
  }

  push();
  return tokens;
}

function stripElevationPrefix(command: string): string {
  return command
    .replace(/^\s*(sudo|doas)\s+(--\s+)?/i, '')
    .replace(/^\s*su\s+-c\s+/i, '')
    .trim();
}

function stripElevationTokens(tokens: string[]): string[] {
  if (!tokens.length) return tokens;
  const first = tokens[0].toLowerCase();
  if (first !== 'sudo' && first !== 'doas') return tokens;

  let index = 1;
  while (index < tokens.length) {
    const token = tokens[index];
    if (token === '--') {
      index += 1;
      break;
    }
    if (!token.startsWith('-')) break;
    index += 1;
  }
  return tokens.slice(index);
}

function normalizeBinary(raw: string): string {
  const parts = raw.split('/').filter(Boolean);
  return (parts[parts.length - 1] ?? raw).toLowerCase();
}

function extractInvocation(segment: string): Invocation | null {
  const rawTokens = stripElevationTokens(tokenizeCommand(stripElevationPrefix(segment)));
  if (!rawTokens.length) return null;

  let index = 0;
  while (index < rawTokens.length && /^[A-Za-z_][A-Za-z0-9_]*=.*/.test(rawTokens[index])) {
    index += 1;
  }
  if (index >= rawTokens.length) return null;

  return {
    binary: normalizeBinary(rawTokens[index]),
    args: rawTokens.slice(index + 1),
  };
}

function looksElevated(segment: string): boolean {
  return /^\s*(sudo|doas)\b/i.test(segment) || /^\s*su\s+-\b/i.test(segment);
}

function firstNonFlagArg(args: string[]): string | null {
  for (const arg of args) {
    if (!arg.startsWith('-')) return arg.toLowerCase();
  }
  return null;
}

function hasSensitivePathArg(args: string[]): boolean {
  return args.some((arg) => {
    const normalized = arg.replace(/^['"]|['"]$/g, '');
    return SENSITIVE_PATH_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
  });
}

function hasSensitivePathRedirection(segment: string): boolean {
  return /(?:>|>>)\s*\/(?:etc|usr|lib|boot|root)\b/i.test(segment);
}

function hasDestructiveRmFlags(invocation: Invocation): boolean {
  if (invocation.binary !== 'rm') return false;

  let hasRecursive = false;
  let hasForce = false;
  for (const rawArg of invocation.args) {
    const arg = rawArg.toLowerCase();
    if (arg === '--') break;
    if (arg === '--recursive' || arg === '-r') hasRecursive = true;
    if (arg === '--force' || arg === '-f') hasForce = true;
    if (/^-[^-]/.test(arg)) {
      if (arg.includes('r')) hasRecursive = true;
      if (arg.includes('f')) hasForce = true;
    }
  }
  return hasRecursive && hasForce;
}

function hasDestructiveDdFlags(invocation: Invocation): boolean {
  return invocation.binary === 'dd' && invocation.args.some((arg) => arg.toLowerCase().startsWith('of='));
}

function hasDestructiveChmod(invocation: Invocation): boolean {
  if (invocation.binary !== 'chmod') return false;
  const mode = firstNonFlagArg(invocation.args) ?? '';
  return mode === '777' || mode === 'a+rwx' || mode === 'o+w';
}

function hasDestructiveKill(invocation: Invocation): boolean {
  if (invocation.binary !== 'killall' && invocation.binary !== 'pkill') return false;
  return invocation.args.some((arg) => arg === '-9' || arg === '--signal=9' || arg.toLowerCase() === '-sigkill');
}

function isDestructiveSegment(segment: string): boolean {
  const invocation = extractInvocation(segment);
  if (invocation) {
    if (DESTRUCTIVE_BINARIES.has(invocation.binary)) return true;
    if (hasDestructiveRmFlags(invocation)) return true;
    if (hasDestructiveDdFlags(invocation)) return true;
    if (hasDestructiveChmod(invocation)) return true;
    if (hasDestructiveKill(invocation)) return true;
  }
  return DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(segment));
}

function isPrivilegedByInvocation(segment: string, facts?: HostFacts): boolean {
  if (facts?.isRoot) return false;
  if (looksElevated(segment)) return false;

  const invocation = extractInvocation(segment);
  if (!invocation) return false;

  if (ALWAYS_PRIVILEGED_BINARIES.has(invocation.binary)) return true;
  if (hasSensitivePathRedirection(segment)) return true;

  if (['cp', 'mv', 'install', 'tee'].includes(invocation.binary) && hasSensitivePathArg(invocation.args)) {
    return true;
  }

  const requiredSubcommands = PRIVILEGED_SUBCOMMANDS[invocation.binary];
  if (!requiredSubcommands) return false;

  const firstCommandArg = firstNonFlagArg(invocation.args);
  if (!firstCommandArg) {
    // pacman operations are often flags only.
    if (invocation.binary === 'pacman') {
      return invocation.args.some((arg) => requiredSubcommands.has(arg.toLowerCase()));
    }
    return false;
  }

  if (requiredSubcommands.has(firstCommandArg)) return true;
  return invocation.args.some((arg) => requiredSubcommands.has(arg.toLowerCase()));
}

function isPrivilegedByPattern(segment: string, facts?: HostFacts): boolean {
  if (facts?.isRoot) return false;
  if (looksElevated(segment)) return false;
  return PRIVILEGED_PATTERNS.some((pattern) => pattern.test(stripElevationPrefix(segment)));
}

function blockedReason(segment: string): string | null {
  for (const { pattern, reason } of BLOCKED_SEGMENT_PATTERNS) {
    if (pattern.test(segment)) return reason;
  }
  return null;
}

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function classifyCommandRisk(command: string, facts?: HostFacts): AgentRiskLevel {
  if (!command.trim()) return 'unknown';
  const segments = splitShellSegments(command);

  for (const segment of segments) {
    if (isDestructiveSegment(segment)) return 'destructive';
  }

  for (const segment of segments) {
    if (isPrivilegedByInvocation(segment, facts) || isPrivilegedByPattern(segment, facts)) {
      return 'needs_privilege';
    }
  }

  return 'safe';
}

export function assessCommandSafety(command: string, facts?: HostFacts): CommandSafetyAssessment {
  const trimmed = command.trim();
  if (!trimmed) {
    return { risk: 'unknown', blocked: true, reason: 'Empty commands are not allowed.' };
  }

  // Some critical patterns (e.g., curl|sh) span segment boundaries.
  const fullCommandReason = blockedReason(trimmed);
  if (fullCommandReason) {
    return { risk: 'destructive', blocked: true, reason: fullCommandReason };
  }

  const segments = splitShellSegments(trimmed);
  for (const segment of segments) {
    const reason = blockedReason(segment);
    if (reason) {
      return { risk: 'destructive', blocked: true, reason };
    }
  }

  return { risk: classifyCommandRisk(trimmed, facts), blocked: false };
}

export function requiresDoubleConfirm(risk: AgentRiskLevel): boolean {
  return risk === 'destructive';
}

export function applyElevation(command: string, shouldElevate: boolean, facts?: HostFacts): string {
  if (!shouldElevate) return command;
  if (facts?.isRoot) return command;
  if (/^\s*(sudo|doas)\b/i.test(command) || /^\s*su\b/i.test(command)) return command;

  return `sudo -- sh -lc ${shellSingleQuote(command)}`;
}
