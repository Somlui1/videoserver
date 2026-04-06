-- 001_add_quality_and_name.sql

-- Add quality column to videos
ALTER TABLE videos ADD COLUMN IF NOT EXISTS quality VARCHAR(20);

-- Add name column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Update existing admin user name
UPDATE users SET name = 'System Administrator' WHERE email = 'admin@company.com';
