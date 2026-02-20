import { Fragment } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import type { PaneNode } from '@shared/types/pane';
import type { Tab } from '../../stores/session-store';
import { TerminalTab } from './TerminalTab';

interface SplitPaneLayoutProps {
  pane: PaneNode;
  parentTab: Tab;
  onSplit: (sessionId: string, direction: 'horizontal' | 'vertical') => void;
  onClosePane: (sessionId: string) => void;
  focusedSessionId?: string;
  onFocus?: (sessionId: string) => void;
}

export function SplitPaneLayout({
  pane,
  parentTab,
  onSplit,
  onClosePane,
  focusedSessionId,
  onFocus,
}: SplitPaneLayoutProps) {
  if (pane.type === 'terminal') {
    const paneTab: Tab = {
      ...parentTab,
      sessionId: pane.sessionId,
      tabId: pane.sessionId,
    };

    return (
      <div
        className={`h-full w-full flex flex-col ${focusedSessionId === pane.sessionId ? 'border-l-2 border-blue-500' : ''}`}
        onClick={() => onFocus?.(pane.sessionId)}
      >
        <TerminalTab
          tab={paneTab}
          onSplit={(direction) => onSplit(pane.sessionId, direction)}
          onClosePane={() => onClosePane(pane.sessionId)}
          isPane
        />
      </div>
    );
  }

  // split node
  return (
    <ResizablePanelGroup
      orientation={pane.direction === 'horizontal' ? 'horizontal' : 'vertical'}
      className="h-full w-full"
    >
      {pane.children.map((child, index) => (
        <Fragment key={index === 0 ? 'first' : `pane-${index}`}>
          {index > 0 && <ResizableHandle withHandle />}
          <ResizablePanel defaultSize={pane.sizes[index] ?? 50}>
            <SplitPaneLayout
              pane={child}
              parentTab={parentTab}
              onSplit={onSplit}
              onClosePane={onClosePane}
              focusedSessionId={focusedSessionId}
              onFocus={onFocus}
            />
          </ResizablePanel>
        </Fragment>
      ))}
    </ResizablePanelGroup>
  );
}
