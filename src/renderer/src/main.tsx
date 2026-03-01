import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { initE2EGate } from './lib/e2e';
import './index.css';

// Apply saved theme before first paint to avoid flash
const saved = localStorage.getItem('archterm-theme') ?? 'dark';
document.documentElement.classList.toggle('dark', saved === 'dark');

// Gate E2E mode against the main process before mounting (C-3).
// initE2EGate resolves immediately in prod (returns false); in dev it awaits
// one IPC round-trip which is fast enough not to affect startup.
initE2EGate().finally(() => {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
