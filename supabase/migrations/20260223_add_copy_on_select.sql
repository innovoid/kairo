-- Add copy_on_select column to settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS copy_on_select boolean DEFAULT false;
