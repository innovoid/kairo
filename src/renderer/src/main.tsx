import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

// Apply saved theme before first paint to avoid flash
const saved = localStorage.getItem('archterm-theme') ?? 'dark';
document.documentElement.classList.toggle('dark', saved === 'dark');

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
