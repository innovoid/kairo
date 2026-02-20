export type PaneNode = TerminalPane | SplitPane;

export interface TerminalPane {
  type: 'terminal';
  sessionId: string;
}

export interface SplitPane {
  type: 'split';
  direction: 'horizontal' | 'vertical';
  children: PaneNode[];
  sizes: number[];
}
