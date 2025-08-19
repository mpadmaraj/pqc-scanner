-- Database initialization script for PQC Scanner
-- This script sets up the PostgreSQL database with proper extensions and initial data

-- Create database if it doesn't exist (handled by Docker environment)
-- CREATE DATABASE pqc_scanner;

-- Connect to the database
\c pqc_scanner;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enums
DO $$ BEGIN
    CREATE TYPE severity AS ENUM ('critical', 'high', 'medium', 'low', 'info');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE scan_status AS ENUM ('pending', 'scanning', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE vulnerability_status AS ENUM ('new', 'reviewing', 'fixed', 'false_positive', 'ignored');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE repository_provider AS ENUM ('github', 'gitlab', 'bitbucket', 'local');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create function to generate UUIDs as default values
CREATE OR REPLACE FUNCTION gen_random_uuid() RETURNS uuid AS $$
BEGIN
    RETURN uuid_generate_v4();
END;
$$ LANGUAGE plpgsql;

-- Grant permissions to the application user
GRANT ALL PRIVILEGES ON DATABASE pqc_scanner TO pqc_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pqc_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pqc_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO pqc_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO pqc_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO pqc_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO pqc_user;

-- Create indexes for better performance (these will be created by Drizzle migrations)
-- But we can create some basic ones for common queries

-- Comment explaining the database setup
COMMENT ON DATABASE pqc_scanner IS 'Post-Quantum Cryptography Vulnerability Scanner Database';

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'PQC Scanner database initialized successfully';
END $$;