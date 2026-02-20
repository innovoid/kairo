-- Add terminal_theme column to settings table
alter table settings
add column if not exists terminal_theme text not null default 'dracula'
check (terminal_theme in ('dracula', 'tokyo-night', 'catppuccin-mocha', 'nord', 'gruvbox-dark', 'one-dark', 'monokai', 'material', 'synthwave', 'ayu-dark', 'horizon', 'github-dark'));
