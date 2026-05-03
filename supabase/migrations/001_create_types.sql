-- 001_create_types.sql
-- Create extensions and foundational types used by subsequent migrations
-- Ensure pgcrypto for uuid generation is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- session_state enum
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'session_state'
) THEN CREATE TYPE session_state AS ENUM ('joinable', 'in_progress', 'completed');
END IF;
END $$;
-- participant_membership_type enum
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'participant_membership_type'
) THEN CREATE TYPE participant_membership_type AS ENUM ('registered', 'guest');
END IF;
END $$;