import type { Terminal } from 'ghostty-web';

interface SearchOptions {
  regex?: boolean;
  caseSensitive?: boolean;
}

interface SearchMatch {
  row: number;
  column: number;
  length: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesEqual(a: SearchOptions, b: SearchOptions): boolean {
  return Boolean(a.regex) === Boolean(b.regex) && Boolean(a.caseSensitive) === Boolean(b.caseSensitive);
}

export interface TerminalSearchApi {
  findNext(query: string, options?: SearchOptions): boolean;
  findPrevious(query: string, options?: SearchOptions): boolean;
}

export class TerminalSearchController implements TerminalSearchApi {
  private terminal: Terminal;

  private lastQuery = '';
  private lastOptions: SearchOptions = {};
  private matches: SearchMatch[] = [];
  private activeIndex = -1;

  constructor(terminal: Terminal) {
    this.terminal = terminal;
  }

  findNext(query: string, options: SearchOptions = {}): boolean {
    if (!this.ensureMatches(query, options)) {
      return false;
    }

    if (this.activeIndex < 0) {
      this.activeIndex = this.findFirstIndexAfterCursor();
    } else {
      this.activeIndex = (this.activeIndex + 1) % this.matches.length;
    }

    this.selectMatch(this.matches[this.activeIndex]);
    return true;
  }

  findPrevious(query: string, options: SearchOptions = {}): boolean {
    if (!this.ensureMatches(query, options)) {
      return false;
    }

    if (this.activeIndex < 0) {
      this.activeIndex = this.findFirstIndexBeforeCursor();
    } else {
      this.activeIndex = (this.activeIndex - 1 + this.matches.length) % this.matches.length;
    }

    this.selectMatch(this.matches[this.activeIndex]);
    return true;
  }

  private ensureMatches(query: string, options: SearchOptions): boolean {
    const trimmed = query ?? '';
    if (!trimmed) {
      this.matches = [];
      this.activeIndex = -1;
      return false;
    }

    const shouldRebuild =
      trimmed !== this.lastQuery || !matchesEqual(options, this.lastOptions);

    if (shouldRebuild) {
      this.matches = this.buildMatches(trimmed, options);
      this.lastQuery = trimmed;
      this.lastOptions = {
        regex: Boolean(options.regex),
        caseSensitive: Boolean(options.caseSensitive),
      };
      this.activeIndex = -1;
    }

    return this.matches.length > 0;
  }

  private buildMatches(query: string, options: SearchOptions): SearchMatch[] {
    const buffer = this.terminal.buffer.active;
    const flags = options.caseSensitive ? 'g' : 'gi';
    const source = options.regex ? query : escapeRegExp(query);
    let pattern: RegExp;

    try {
      pattern = new RegExp(source, flags);
    } catch {
      return [];
    }

    const matches: SearchMatch[] = [];

    for (let row = 0; row < buffer.length; row += 1) {
      const line = buffer.getLine(row)?.translateToString(false) ?? '';
      pattern.lastIndex = 0;

      let result = pattern.exec(line);
      while (result) {
        const value = result[0] ?? '';
        if (value.length > 0) {
          matches.push({
            row,
            column: result.index,
            length: value.length,
          });
        }

        if (pattern.lastIndex === result.index) {
          pattern.lastIndex += 1;
        }
        result = pattern.exec(line);
      }
    }

    return matches;
  }

  private findFirstIndexAfterCursor(): number {
    const position = this.terminal.getSelectionPosition();
    if (!position) return 0;

    const { y, x } = position.end;
    const idx = this.matches.findIndex((match) => match.row > y || (match.row === y && match.column > x));
    return idx >= 0 ? idx : 0;
  }

  private findFirstIndexBeforeCursor(): number {
    const position = this.terminal.getSelectionPosition();
    if (!position) return Math.max(this.matches.length - 1, 0);

    const { y, x } = position.start;
    for (let index = this.matches.length - 1; index >= 0; index -= 1) {
      const match = this.matches[index];
      if (match.row < y || (match.row === y && match.column < x)) {
        return index;
      }
    }

    return Math.max(this.matches.length - 1, 0);
  }

  private selectMatch(match: SearchMatch): void {
    this.terminal.select(match.column, match.row, match.length);
    this.terminal.scrollToLine(match.row);
  }
}

