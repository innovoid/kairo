# ArchTerm Roadmap

## Current Version (v0.1.0)

### ✅ Completed Features

**Authentication & Workspaces:**
- Email/password authentication with Supabase
- OAuth (GitHub, Google) login
- Workspace creation and management
- Team collaboration (members, invites, roles)
- Workspace encryption for SSH keys (backend complete)

**Host Management:**
- CRUD operations for SSH hosts
- Folder organization with drag-and-drop
- Host tagging and search
- Context menus (connect, edit, delete, move to folder)
- Local-first architecture (instant UI updates)

**SSH Terminal:**
- xterm.js terminal emulator
- Multiple concurrent sessions
- Tab management (singleton tabs for static sections)
- 12 beautiful terminal color themes
- Customizable cursor styles (block, bar, underline)
- Font family and size selection
- Scrollback configuration

**SSH Keys:**
- Import PEM/OpenSSH private keys with passphrase support
- Automatic Supabase metadata sync
- Key management (list, delete, export public key)
- Workspace-level encrypted key storage (backend ready)

**SFTP File Browser:**
- Basic file listing
- Upload/download functionality
- Transfer progress tracking
- File operations (mkdir, rename, delete, chmod)

**Settings:**
- Terminal settings (font, theme, cursor, scrollback)
- Appearance settings (dark/light mode)
- AI provider configuration (OpenAI, Anthropic, Gemini)

---

## In Progress (v0.2.0) - Weeks 1-3

### Week 1: Critical Features

**User Profile & Logout:**
- [ ] User profile button in sidebar
- [ ] User menu dropdown
- [ ] Profile page (view/edit name, change password)
- [ ] Logout functionality
- [ ] Account deletion with data cleanup
- [ ] Account settings tab

**Workspace Settings Page:**
- [ ] Replace Team sidebar icon with Workspace
- [ ] General tab (rename, delete, leave workspace)
- [ ] Encryption tab (passphrase management, key sync UI)
- [ ] Team tab (move existing TeamPage here)
- [ ] Workspace switcher component

### Week 2: Enhancements

**Settings Improvements:**
- [ ] Account tab in Settings
- [ ] Data export functionality
- [ ] Workspace switcher in settings
- [ ] User avatar with initials

**Polish Features:**
- [ ] Command palette (Cmd+K)
- [ ] Better empty states (hosts, keys)
- [ ] Welcome screen for new users

### Week 3: Nice-to-Haves (If Time Permits)

**AI Assistant Panel:**
- [ ] Right sidebar drawer
- [ ] Chat interface with AI
- [ ] Command suggestions
- [ ] "Insert into terminal" functionality
- [ ] Command explanation feature

---

## Planned Features (v0.3.0 - Future)

### Phase 1: Identity & Security

**Avatar Upload:**
- Upload profile pictures
- Store in Supabase Storage
- Crop and resize to 48x48px
- Show in sidebar, user menu, profile, team list

**Two-Factor Authentication:**
- TOTP (Time-based One-Time Password)
- Backup codes generation
- QR code for authenticator apps
- Enforce 2FA for workspace owners

**Session Management:**
- View all active sessions
- Device information (browser, OS, location)
- Revoke individual sessions
- "Sign out everywhere" option

### Phase 2: Advanced Workspace Features

**Workspace Templates:**
- Pre-configured workspace setups
- Template marketplace
- Export/import workspace configurations
- Quick workspace creation from templates

**Audit Logs:**
- Track all workspace activities
- Who did what when
- Filter by user, action, date range
- Export audit logs

**Advanced RBAC Permissions:**
- Custom roles beyond Owner/Admin/Member
- Granular permissions (can_add_hosts, can_delete_keys, etc.)
- Role templates
- Permission inheritance

**Workspace Favorites:**
- Star/favorite workspaces
- Quick access to frequently used workspaces
- Reorder workspace list
- Workspace groups

### Phase 3: Advanced Terminal Features

**Terminal Enhancements:**
- Split panes (vertical/horizontal)
- Terminal broadcast (send to multiple terminals)
- Terminal recording and playback
- Custom key bindings
- Terminal search (Ctrl+F in terminal)

**Advanced AI Features:**
- Voice commands for terminal
- Terminal auto-fix (detect errors, suggest fixes)
- Command history AI suggestions
- Natural language to bash converter
- Explain terminal output

**Terminal Themes:**
- Custom theme creator
- Import themes from iTerm2, VSCode
- Theme marketplace
- Automatic theme switching (time-based)

### Phase 4: Collaboration & Sharing

**Real-time Collaboration:**
- Share terminal session with team members
- Multiple users in same terminal
- Cursor visibility for collaborators
- Voice/text chat during collaboration

**Snippets & Playbooks:**
- Save frequently used commands
- Organize into playbooks
- Share with team
- Variables in snippets
- Execute playbook sequences

**Host Sharing:**
- Share individual hosts with team members
- Share entire folders
- Granular access control per host
- Temporary access links

### Phase 5: Monitoring & Observability

**Connection Monitoring:**
- Connection status dashboard
- Uptime monitoring
- Connection history and analytics
- Alert on connection failures

**Resource Monitoring:**
- CPU, memory, disk usage
- Network traffic visualization
- Process list and management
- Real-time system metrics

**Log Aggregation:**
- Collect logs from multiple hosts
- Search and filter logs
- Log alerts and notifications
- Export logs for analysis

### Phase 6: Mobile & Desktop Apps

**Mobile App (iOS/Android):**
- React Native app
- Basic SSH terminal
- Host management
- Quick connect functionality
- Push notifications for alerts

**Native Desktop Apps:**
- Native macOS app (Swift/SwiftUI)
- Native Windows app (C#/WPF)
- Native Linux app (Qt/GTK)
- Better OS integration
- System tray support

### Phase 7: Enterprise Features

**Billing & Subscriptions:**
- Usage-based pricing
- Workspace limits (hosts, keys, members)
- Payment integration (Stripe)
- Invoicing and receipts
- Enterprise plans

**Single Sign-On (SSO):**
- SAML 2.0 support
- OAuth providers (Okta, Auth0, Azure AD)
- LDAP integration
- Just-in-Time provisioning

**Compliance & Governance:**
- SOC 2 Type II compliance
- GDPR compliance tools
- Data residency options
- Encryption key management (BYOK)
- Compliance reporting

---

## Out of Scope (Not Planned)

Features explicitly not planned for ArchTerm:

**Different Product Direction:**
- Desktop automation tools
- CI/CD pipeline runner
- Container orchestration
- Infrastructure as Code (IaC) tooling

**Better Served by Other Tools:**
- Code editor integration (use VSCode Remote-SSH)
- Database management (use dedicated DB tools)
- API testing (use Postman, Insomnia)
- Git GUI (use dedicated Git clients)

---

## Community Requests

Want a feature not on the roadmap? Open an issue on GitHub:
https://github.com/yourusername/arch-term/issues

**How to Request Features:**
1. Check if feature already requested
2. Describe the use case (not just the feature)
3. Explain why existing solutions don't work
4. Optional: Provide mockups or examples

---

## Release Schedule

**v0.1.0** - Current (February 2026)
- Core SSH terminal and file browser
- Basic host and key management

**v0.2.0** - March 2026 (Weeks 1-3)
- User profile and workspace settings
- Command palette and empty states
- AI assistant panel

**v0.3.0** - Q2 2026
- Avatar upload
- Two-factor authentication
- Session management

**v0.4.0** - Q3 2026
- Advanced workspace features
- Audit logs
- Workspace templates

**v0.5.0** - Q4 2026
- Advanced terminal features
- Real-time collaboration
- Snippets and playbooks

**v1.0.0** - Q1 2027
- Mobile apps
- Enterprise features
- Production-ready release

---

## Contributing

Want to help build ArchTerm? Check out our contribution guide:
https://github.com/yourusername/arch-term/CONTRIBUTING.md

**Areas We Need Help:**
- UI/UX design for new features
- Terminal theme contributions
- Documentation and tutorials
- Testing and bug reports
- Feature implementations

---

**Last Updated:** February 20, 2026
