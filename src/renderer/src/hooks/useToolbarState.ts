import { useState, useEffect } from 'react';

export type ToolbarOrientation = 'horizontal' | 'vertical';

export interface ToolbarPosition {
  x: number;
  y: number;
}

export interface ToolbarState {
  position: ToolbarPosition;
  orientation: ToolbarOrientation;
}

const DEFAULT_POSITION: ToolbarPosition = {
  x: window.innerWidth - 280, // 280px from left (right side)
  y: window.innerHeight - 80, // 80px from top (bottom)
};

const DEFAULT_ORIENTATION: ToolbarOrientation = 'horizontal';

const STORAGE_KEY = 'archterm-toolbar-state';

export function useToolbarState() {
  const [state, setState] = useState<ToolbarState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          position: parsed.position || DEFAULT_POSITION,
          orientation: parsed.orientation || DEFAULT_ORIENTATION,
        };
      }
    } catch (error) {
      console.error('Failed to load toolbar state:', error);
    }
    return {
      position: DEFAULT_POSITION,
      orientation: DEFAULT_ORIENTATION,
    };
  });

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save toolbar state:', error);
    }
  }, [state]);

  const setPosition = (position: ToolbarPosition) => {
    setState((prev) => ({ ...prev, position }));
  };

  const setOrientation = (orientation: ToolbarOrientation) => {
    setState((prev) => ({ ...prev, orientation }));
  };

  const resetToDefault = () => {
    setState({
      position: DEFAULT_POSITION,
      orientation: DEFAULT_ORIENTATION,
    });
  };

  return {
    position: state.position,
    orientation: state.orientation,
    setPosition,
    setOrientation,
    resetToDefault,
  };
}
