CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
    CREATE TYPE access_level_enum AS ENUM('private', 'enrolled', 'org');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE status_enum AS ENUM('pending', 'transcoding', 'ready', 'error');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE role_enum AS ENUM('admin', 'uploader', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role role_enum NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    course_id VARCHAR(100),
    access_level access_level_enum DEFAULT 'private',
    status status_enum DEFAULT 'pending',
    quality VARCHAR(20),
    uploader_id UUID REFERENCES users(id),
    duration_seconds INTEGER,
    file_size_bytes BIGINT,
    progress INTEGER DEFAULT 0,
    failed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default admin user (password: 'admin1234')
INSERT INTO users (id, email, password_hash, name, role)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@company.com',
    '$2a$10$6zdx3D8IgSyqIPdQV17AjuE2DJvE/gd6xySt0XxGE4dMIoiDsAM8q',
    'System Administrator',
    'admin'
) ON CONFLICT (email) DO NOTHING;
