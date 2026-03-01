import type { AgentRiskLevel, HostFacts } from '../../shared/types/agent';

const DESTRUCTIVE_PATTERNS: RegExp[] = [
  // Disk formatting / partitioning
  /\bmkfs\b/i,
  /\bfdisk\b/i,
  /\bparted\b/i,
  /\bwipefs\b/i,
  // Block device overwrite
  /\bdd\b.*\b(of=|if=)\b/i,
  // System power
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bpoweroff\b/i,
  /\bhalt\b/i,
  /\binit\s+[016]\b/i,
  // User/group deletion
  /\buserdel\b/i,
  /\bgroupdel\b/i,
  // Firewall changes (could lock you out)
  /\biptables\s+(-F|-X|--flush|--delete-chain)\b/i,
  /\bnft\s+flush\b/i,
  /\bufw\s+(reset|disable)\b/i,
  /\bfirewall-cmd\s+.*--remove\b/i,
  // Dangerous chmod
  /\bchmod\s+(777|a\+rwx|o\+w)\b/i,
  // Drop databases
  /\bdrop\s+(database|table|schema)\b/i,
  // Truncate partition tables
  /\bsgdisk\s+.*-Z\b/i,
  // Kill all processes
  /\bkillall\s+-9\b/i,
  /\bpkill\s+.*-9\b/i,
];

const PRIVILEGED_PATTERNS: RegExp[] = [
  // Package management
  /\bapt(-get)?\s+(install|remove|purge|upgrade|update|dist-upgrade|autoremove)\b/i,
  /\bdnf\s+(install|remove|upgrade|update|autoremove|reinstall)\b/i,
  /\byum\s+(install|remove|upgrade|update|reinstall)\b/i,
  /\bpacman\s+(-S|-R|-U|-D)\b/i,
  /\bzypper\s+(install|remove|update|upgrade|in|rm|up)\b/i,
  /\bapk\s+(add|del|upgrade|update)\b/i,
  /\bbrew\s+(install|uninstall|upgrade)\b/i,
  // Service management
  /\bsystemctl\s+(start|stop|restart|enable|disable|reload|mask|unmask)\b/i,
  /\bservice\s+\S+\s+(start|stop|restart|reload)\b/i,
  /\brc-service\b/i,
  /\brc-update\b/i,
  // Writing to system directories
  /\btee\s+\/etc\//i,
  /\btee\s+\/usr\//i,
  /\btee\s+\/lib\//i,
  /\bcp\b.*\/etc\//i,
  /\bmv\b.*\/etc\//i,
  /\binstall\b.*\/etc\//i,
  /\binstall\b.*\/usr\//i,
  // Kernel / modules
  /\bmodprobe\b/i,
  /\binsmod\b/i,
  /\brmmod\b/i,
  // Network config
  /\bip\s+(addr|route|link)\s+(add|del|set|flush)\b/i,
  /\bifconfig\b/i,
  /\bnmcli\s+(con|connection|device)\s+(add|del|modify|up|down)\b/i,
  // User management
  /\buseradd\b/i,
  /\busermod\b/i,
  /\bpasswd\b/i,
  /\bchown\b/i,
  // Mount/unmount
  /\bmount\b/i,
  /\bumount\b/i,
  // Cron / scheduled jobs
  /\bcrontab\s+-[rie]\b/i,
];

function splitShellSegments(command: string): string[] {
  return command
    .split(/(?:\|\||&&|;|\n)/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function stripElevationPrefix(command: string): string {
  return command
    .replace(/^\s*(sudo|doas)\s+(--\s+)?/i, '')
    .replace(/^\s*su\s+-c\s+/i, '')
    .trim();
}

function looksLikeRmCommand(binary: string): boolean {
  return /(^|\/)rm$/i.test(binary);
}

function hasDestructiveRmFlags(segment: string): boolean {
  const cleaned = stripElevationPrefix(segment);
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || !looksLikeRmCommand(tokens[0])) return false;

  let hasRecursive = false;
  let hasForce = false;
  for (const token of tokens.slice(1)) {
    const lower = token.toLowerCase();
    if (lower === '--') break;

    if (lower === '--recursive' || lower === '-r') {
      hasRecursive = true;
      continue;
    }

    if (lower === '--force' || lower === '-f') {
      hasForce = true;
      continue;
    }

    if (/^-[^-]/.test(lower)) {
      if (lower.includes('r')) hasRecursive = true;
      if (lower.includes('f')) hasForce = true;
    }
  }

  return hasRecursive && hasForce;
}

function isDestructive(command: string): boolean {
  const segments = splitShellSegments(command);
  return segments.some((segment) => {
    if (hasDestructiveRmFlags(segment)) return true;
    return DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(segment));
  });
}

function needsPrivilege(command: string, facts?: HostFacts): boolean {
  if (facts?.isRoot) return false;

  const segments = splitShellSegments(command);
  return segments.some((segment) => {
    const normalized = stripElevationPrefix(segment);
    if (/^\s*(sudo|doas)\b/i.test(segment) || /^\s*su\s+-\b/i.test(segment)) return false;
    return PRIVILEGED_PATTERNS.some((pattern) => pattern.test(normalized));
  });
}

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
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
  if (/^\s*(sudo|doas)\b/i.test(command) || /^\s*su\b/i.test(command)) return command;

  // Use sudo with an explicit command boundary to avoid option injection.
  return `sudo -- sh -lc ${shellSingleQuote(command)}`;
}
