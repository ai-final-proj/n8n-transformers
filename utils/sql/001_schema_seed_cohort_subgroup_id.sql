-- Drop old tables
DROP TABLE IF EXISTS schedule_item CASCADE;
DROP TABLE IF EXISTS period CASCADE;
DROP TABLE IF EXISTS public."user" CASCADE;
DROP TABLE IF EXISTS system_role CASCADE;
DROP TABLE IF EXISTS schedule CASCADE;
DROP TABLE IF EXISTS program CASCADE;
DROP TABLE IF EXISTS cohort_subgroup CASCADE;
DROP TABLE IF EXISTS cohort CASCADE;

-- Drop enums if they exist
DROP TYPE IF EXISTS role_code CASCADE;
DROP TYPE IF EXISTS user_status CASCADE;
DROP TYPE IF EXISTS period_category CASCADE;

-- Enums
CREATE TYPE role_code AS ENUM (
    'instructor',
    'learner',
    'admin',
    'replacement_instructor',
    'visiting_instructor'
);

CREATE TYPE user_status AS ENUM (
    'active',
    'inactive'
);

CREATE TYPE period_category AS ENUM (
    'virtual_reality',
    'face_to_face',
    'assessment',
    'learning_course',
    'other'
);

-- Tables
CREATE TABLE program (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    name VARCHAR(255) NOT NULL,
    description TEXT
);

CREATE TABLE cohort (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    program_id INTEGER REFERENCES program(id)
);

CREATE TABLE cohort_subgroup (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    name VARCHAR(255) NOT NULL,
    cohort_id INTEGER NOT NULL REFERENCES cohort(id)
);

CREATE TABLE schedule (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    program_id INTEGER REFERENCES program(id),
    cohort_id INTEGER REFERENCES cohort(id),
    cohort_subgroup_id INTEGER REFERENCES cohort_subgroup(id)
);

CREATE TABLE system_role (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    code role_code NOT NULL
);

CREATE TABLE public."user" (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role_id INTEGER NOT NULL REFERENCES system_role(id),
    cohort_id INTEGER REFERENCES cohort(id),
    cohort_subgroup_id INTEGER REFERENCES cohort_subgroup(id),
    status user_status NOT NULL
);

CREATE TABLE period (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    instructor_id INTEGER REFERENCES public."user"(id),
    location_url VARCHAR(512),
    capacity INTEGER,
    category period_category NOT NULL
);

CREATE TABLE schedule_item (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    schedule_id INTEGER NOT NULL REFERENCES schedule(id),
    program_id INTEGER REFERENCES program(id),
    period_id INTEGER REFERENCES period(id),
    cohort_id INTEGER REFERENCES cohort(id),
    cohort_subgroup_id INTEGER REFERENCES cohort_subgroup(id),
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL
);

-- Seed Data
INSERT INTO system_role (name, description, code, created_at, updated_at) VALUES
('Admin', 'System administrator', 'admin', NOW(), NOW()),
('Instructor', 'Main instructor', 'instructor', NOW() - interval '1 day', NOW() - interval '1 day'),
('Learner', 'Student learner', 'learner', NOW() - interval '2 days', NOW() - interval '2 days'),
('Replacement Instructor', 'Backup instructor', 'replacement_instructor', NOW() - interval '3 days', NOW() - interval '3 days'),
('Visiting Instructor', 'Guest instructor', 'visiting_instructor', NOW() - interval '4 days', NOW() - interval '4 days');

INSERT INTO cohort (name, description, created_at, updated_at) VALUES
('Cohort 1', 'First test cohort', NOW() - interval '5 days', NOW() - interval '4 days'),
('Cohort 2', 'Second test cohort', NOW() - interval '3 days', NOW() - interval '2 days');

INSERT INTO cohort_subgroup (name, cohort_id, created_at, updated_at) VALUES
('Subgroup A', 1, NOW() - interval '4 days', NOW() - interval '3 days'),
('Subgroup B', 1, NOW() - interval '3 days', NOW() - interval '2 days'),
('Subgroup C', 2, NOW() - interval '2 days', NOW() - interval '1 day');

INSERT INTO program (name, description, created_at, updated_at) VALUES
('Intro to VR', 'Virtual reality basics', NOW() - interval '6 days', NOW() - interval '5 days'),
('Data Science 101', 'Fundamentals of data science', NOW() - interval '5 days', NOW() - interval '4 days');

INSERT INTO public."user" (name, email, role_id, status, created_at, updated_at)
VALUES ('Admin User', 'admin@example.com', 1, 'active', NOW(), NOW());

-- Instructors
INSERT INTO public."user" (name, email, role_id, status, created_at, updated_at)
SELECT 
  'Instructor ' || LPAD(n::text, 3, '0'),
  'instructor' || LPAD(n::text, 3, '0') || '@example.com',
  2,
  'active',
  NOW() - (n || ' days')::interval,
  NOW() - ((n - 1) || ' days')::interval
FROM generate_series(1,5) AS n;

-- Visiting Instructors (role_id = 5)
INSERT INTO public."user" (name, email, role_id, status, created_at, updated_at)
VALUES 
  ('Visiting Instructor 001', 'visiting001@example.com', 5, 'active', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '10 minutes'),
  ('Visiting Instructor 002', 'visiting002@example.com', 5, 'active', NOW() - INTERVAL '9 minutes', NOW() - INTERVAL '9 minutes');

-- Replacement Instructors (role_id = 4)
INSERT INTO public."user" (name, email, role_id, status, created_at, updated_at)
VALUES 
  ('Replacement Instructor 001', 'replacement001@example.com', 4, 'active', NOW() - INTERVAL '8 minutes', NOW() - INTERVAL '8 minutes'),
  ('Replacement Instructor 002', 'replacement002@example.com', 4, 'active', NOW() - INTERVAL '7 minutes', NOW() - INTERVAL '7 minutes');

-- Learners Cohort 1
INSERT INTO public."user" (name, email, role_id, status, cohort_id, cohort_subgroup_id, created_at, updated_at)
SELECT 
  'Learner ' || LPAD(n::text, 3, '0'),
  'learner' || LPAD(n::text, 3, '0') || '@example.com',
  3,
  'active',
  1,
  CASE WHEN n % 2 = 0 THEN 1 ELSE 2 END,
  NOW() - (n || ' hours')::interval,
  NOW() - ((n + 1) || ' hours')::interval
FROM generate_series(1,50) AS n;

-- Learners Cohort 2
INSERT INTO public."user" (name, email, role_id, status, cohort_id, cohort_subgroup_id, created_at, updated_at)
SELECT 
  'Learner_' || LPAD((n+50)::text, 3, '0'),
  'learner' || (n+50)::text || '@example.com',
  3,
  'active',
  2,
  3,
  NOW() - ((n + 50) || 'hours')::interval,
  NOW() - ((n + 51) || 'hours')::interval
FROM generate_series(1,50) AS n;

-- Periods for Intro to VR
INSERT INTO period (name, description, instructor_id, location_url, capacity, category, created_at, updated_at)
SELECT 
  'VR Period ' || n,
  'Session ' || n || ' for Intro to VR program.',
  (SELECT id FROM public."user" WHERE role_id = 2 LIMIT 1),
  'http://vr.example.com/session' || n,
  20 + n,
  'virtual_reality',
  NOW() - (n || ' days')::interval,
  NOW() - ((n - 1) || ' days')::interval
FROM generate_series(1,10) AS n;

-- Periods for Data Science 101
INSERT INTO period (name, description, instructor_id, location_url, capacity, category, created_at, updated_at)
SELECT 
  'DS Period ' || n,
  'Session ' || n || ' for Data Science 101 program.',
  (SELECT id FROM public."user" WHERE role_id = 2 OFFSET 1 LIMIT 1),
  'http://ds.example.com/session' || n,
  25 + n,
  'learning_course',
  NOW() - (n || ' days')::interval,
  NOW() - ((n - 1) || ' days')::interval
FROM generate_series(1,10) AS n;

