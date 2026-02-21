-- Add prompt_style column to settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS prompt_style TEXT DEFAULT 'default';
