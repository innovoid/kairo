# Kairo

<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0-emerald" alt="Version">
  <img src="https://img.shields.io/badge/platform-mac%20%7C%20windows-blue" alt="Platform">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
</p>

Kairo is an **AI-powered SSH client** for macOS and Windows, built with Electron, React 18, and TypeScript. It combines a modern terminal experience with intelligent AI assistance and seamless team collaboration.

## Why Kairo?

Traditional SSH clients are powerful but lack modern UX. Kairo brings:

- 🤖 **AI Agent** — Plan complex tasks, approve steps one-by-one, let AI analyze output after each command
- ⚡ **Ghostty Terminal** — GPU-accelerated terminal rendering via WebAssembly
- 👥 **Team Workspaces** — Shared SSH hosts, encrypted keys, role-based access
- 📁 **Integrated SFTP** — File transfers without leaving the app
- ⌨️ **Command Hints** — Type `@` for contextual AI assistance right in your terminal

---

## Features

### 🤖 AI Agent

A conversational AI assistant embedded directly in the terminal:

- **Natural language tasks**: "Check why my Docker + Traefik app is not working"
- **Step-by-step planning**: AI proposes a plan, you approve each step
- **Output analysis**: After each command, AI analyzes the result and decides what to do next
- **Playbooks**: Save successful runs as reusable playbooks
- **Multi-provider**: Gemini (default), OpenAI, Anthropic

**Example workflow:**
1. You: "Install and configure nginx as a reverse proxy"
2. AI: Plans 3 steps (apt-get update, apt-get install nginx, systemctl enable nginx)
3. You approve each step — AI runs it and analyzes output
4. AI verifies nginx is running and reports success

### 🖥️ Terminal

- **Ghostty-powered**: GPU-accelerated WebAssembly terminal
- **Local + SSH**: Local shells and remote SSH sessions
- **Split panes**: Horizontal/vertical splits for side-by-side terminals
- **Broadcast mode**: Type once, send to multiple sessions
- **Recording**: Record terminal sessions for playback
- **Search**: Full-text search with regex support

### 📁 SFTP File Transfers

- Upload via button, drag-and-drop, or `@upload` command
- Download with double-click or `@download` command
- Progress bars with speed/ETA
- Multiple concurrent transfers
- Remote file browser with breadcrumbs

### 🗂️ Host Management

- Folder-based organization with drag-and-drop
- Multiple authentication methods:
  - Password (stored securely)
  - SSH private keys (encrypted, synced per-workspace)
  - SSH agent forwarding
- Connection status indicators
- Reconnect with one click

### 👥 Team Collaboration

- **Workspaces**: Isolated environments for teams or personal use
- **Role-based access**: Owner, Admin, Member
- **Invitations**: Share workspaces via email tokens
- **Encrypted key sync**: SSH private keys encrypted with workspace passphrase

### ⚙️ Settings

- **Terminal**: Font, size, cursor style, scrollback, bell, copy-on-select
- **Appearance**: Dark/light theme
- **AI**: Provider selection, model choice, API key management
- **Prompt style**: default, minimal, directory

### ⌨️ Command Hints

Type `@` in any terminal for contextual commands:

| Command | Description |
|---------|-------------|
| `@ai <question>` | Ask AI a question about the remote system |
| `@upload` | Open file picker to upload to current directory |
| `@download <filename>` | Download a file from remote |
| `@suggest` | Get command suggestions based on context |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Electron 33+ |
| UI | React 18, TypeScript, Tailwind CSS v4 |
| State | Zustand |
| Terminal | Ghostty (WebAssembly) |
| Database | Supabase (PostgreSQL) |
| AI | Vercel AI SDK (OpenAI, Anthropic, Gemini) |
| SSH | ssh2 |
| Build | electron-vite, electron-builder |

---

## Keyboard Shortcuts

Press `Cmd+K` and search "shortcuts" to view all in-app.

### General
- `Cmd+K` — Command palette
- `Cmd+,` — Settings

### Terminal
- `Cmd+T` — New connection
- `Cmd+L` — Local terminal
- `Cmd+W` — Close tab
- `Cmd+D` — Split horizontal
- `Cmd+Shift+D` — Split vertical
- `Cmd+F` — Search

### Navigation
- `Cmd+H` — Browse hosts
- `Cmd+B` — SFTP browser
- `Cmd+;` — Snippets

### Recording
- `Cmd+Shift+R` — Start/stop recording
- `Cmd+Shift+B` — Toggle broadcast

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Supabase project (for cloud sync)

### Installation

```bash
# Clone the repository
git clone https://github.com/alihussnainrb/arch-term.git
cd arch-term

# Install dependencies
npm install

# Run in development
npm run dev
```

### Environment Variables

Create a `.env` file:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Building

```bash
# Build for macOS
npm run dist -- --mac

# Build for Windows
npm run dist -- --win
```

---

## Architecture

### Main Process (Electron)

- `src/main/index.ts` — App entry, window management
- `src/main/services/ssh-manager.ts` — SSH connection handling
- `src/main/services/sftp-manager.ts` — SFTP operations
- `src/main/services/agent-orchestrator.ts` — AI agent execution
- `src/main/ipc/` — IPC handlers for renderer communication

### Renderer Process (React)

- `src/renderer/src/features/terminal/` — Terminal UI and logic
- `src/renderer/src/features/agent/` — AI agent panel
- `src/renderer/src/features/hosts/` — Host management
- `src/renderer/src/stores/` — Zustand state stores

### Preload

- `src/preload/` — Secure IPC bridge (contextBridge)

---

## Database Schema

Key tables:

- `workspaces` — Team workspaces
- `workspace_members` — User membership with roles
- `hosts` — SSH host configurations
- `encrypted_keys` — Workspace-encrypted SSH private keys
- `snippets` — Saved command snippets
- `agent_playbooks` — Saved AI agent workflows

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run checks:
   - `npm run typecheck`
   - `npm run test:run`
   - `npm run test:db` (requires Docker + local Supabase stack)
   - `npm run test:e2e:workflow` (targeted Electron workflow smoke)
5. Submit a PR

---

## License

MIT License — see LICENSE file for details.

---

## Roadmap

- [ ] v1.0 public release
- [ ] Auto-updater integration
- [ ] Terminal themes
- [ ] More AI provider integrations
- [ ] i18n support
