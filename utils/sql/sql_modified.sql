-- ========================================
-- DROP OLD TABLES AND ENUMS
-- ========================================
DROP TABLE IF EXISTS schedule_item CASCADE;
DROP TABLE IF EXISTS period CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;
DROP TABLE IF EXISTS system_role CASCADE;
DROP TABLE IF EXISTS schedule CASCADE;
DROP TABLE IF EXISTS program CASCADE;
DROP TABLE IF EXISTS cohort_subgroup CASCADE;
DROP TABLE IF EXISTS cohort CASCADE;

DROP TYPE IF EXISTS role_code CASCADE;
DROP TYPE IF EXISTS user_status CASCADE;
DROP TYPE IF EXISTS period_category CASCADE;

-- ========================================
-- CREATE ENUM TYPES
-- ========================================
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

-- ========================================
-- CREATE TABLES
-- ========================================
CREATE TABLE program (
    id SERIAL PRIMARY KEY,
    program_name VARCHAR(255) NOT NULL,
    program_description TEXT
);

CREATE TABLE cohort (
    id SERIAL PRIMARY KEY,
    cohort_name VARCHAR(255) NOT NULL,
    cohort_description TEXT,
    program_id INTEGER REFERENCES program(id)
);

CREATE TABLE cohort_subgroup (
    id SERIAL PRIMARY KEY,
    cohort_subgroup_name VARCHAR(255) NOT NULL,
    cohort_id INTEGER NOT NULL REFERENCES cohort(id)
);

CREATE TABLE schedule (
    id SERIAL PRIMARY KEY,
    schedule_name VARCHAR(255) NOT NULL,
    schedule_description TEXT,
    program_id INTEGER REFERENCES program(id),
    cohort_id INTEGER REFERENCES cohort(id),
    cohort_cohort_subgroup_id INTEGER REFERENCES cohort_subgroup(id)
);

CREATE TABLE system_role (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(255) NOT NULL,
    role_description TEXT,
    role_code role_code NOT NULL
);

CREATE TABLE "user" (
    id SERIAL PRIMARY KEY,
    user_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role_id INTEGER NOT NULL REFERENCES system_role(id),
    role_code role_code REFERENCES system_role(role_code),
    cohort_id INTEGER REFERENCES cohort(id),
    cohort_cohort_subgroup_id INTEGER REFERENCES cohort_subgroup(id),
    status user_status NOT NULL
);

CREATE TABLE period (
    id SERIAL PRIMARY KEY,
    period_name VARCHAR(255) NOT NULL,
    period_description TEXT,
    instructor_id INTEGER REFERENCES "user"(id),
    location_url VARCHAR(512),
    capacity INTEGER,
    category period_category NOT NULL
);

CREATE TABLE schedule_item (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER NOT NULL REFERENCES schedule(id),
    program_id INTEGER REFERENCES program(id),
    period_id INTEGER REFERENCES period(id),
    cohort_id INTEGER REFERENCES cohort(id),
    cohort_cohort_subgroup_id INTEGER REFERENCES cohort_subgroup(id),
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL
);

-- ========================================
-- SEED DATA
-- ========================================

-- Roles
INSERT INTO system_role (role_name, role_description, role_code) VALUES
('Admin', 'System administrator', 'admin'),
('Instructor', 'Main instructor', 'instructor'),
('Learner', 'Student learner', 'learner'),
('Replacement Instructor', 'Backup instructor', 'replacement_instructor'),
('Visiting Instructor', 'Guest instructor', 'visiting_instructor');

-- Programs
INSERT INTO program (program_name, program_description) VALUES
('Intro to VR', 'Virtual reality basics'),
('Data Science 101', 'Fundamentals of data science');

-- Cohorts
INSERT INTO cohort (cohort_name, cohort_description, program_id) VALUES
('Cohort 1', 'First test cohort', 1),
('Cohort 2', 'Second test cohort', 2);

-- Subgroups
INSERT INTO cohort_subgroup (cohort_subgroup_name, cohort_id) VALUES
('Subgroup A', 1),
('Subgroup B', 1),
('Subgroup C', 2);

-- Admin user
INSERT INTO "user" (user_name, email, role_id, role_code, status)
VALUES ('Admin User', 'admin@example.com', 1, 'admin', 'active');

-- Instructors (5)
INSERT INTO "user" (user_name, email, role_id, role_code, status)
SELECT 
  'Instructor ' || LPAD(n::text, 3, '0'),
  'instructor' || LPAD(n::text, 3, '0') || '@example.com',
  2,
  'instructor',
  'active'
FROM generate_series(1,5) AS n;

-- Replacement Instructors (2)
INSERT INTO "user" (user_name, email, role_id, role_code, status)
SELECT 
  'Replacement Instructor ' || LPAD(n::text, 3, '0'),
  'replacement' || LPAD(n::text, 3, '0') || '@example.com',
  4,
  'replacement_instructor',
  'active'
FROM generate_series(1,2) AS n;

-- Visiting Instructors (2)
INSERT INTO "user" (user_name, email, role_id, role_code, status)
SELECT 
  'Visiting Instructor ' || LPAD(n::text, 3, '0'),
  'visiting' || LPAD(n::text, 3, '0') || '@example.com',
  5,
  'visiting_instructor',
  'active'
FROM generate_series(1,2) AS n;

-- Learners (50) in Cohort 1, Subgroups A/B
INSERT INTO "user" (user_name, email, role_id, role_code, status, cohort_id, cohort_cohort_subgroup_id)
SELECT 
  'Learner ' || LPAD(n::text, 3, '0'),
  'learner' || LPAD(n::text, 3, '0') || '@example.com',
  3,
  'learner',
  'active',
  1,
  CASE WHEN n % 2 = 0 THEN 1 ELSE 2 END
FROM generate_series(1,50) AS n;

-- Learners (50) in Cohort 2, Subgroup C
INSERT INTO "user" (user_name, email, role_id, role_code, status, cohort_id, cohort_cohort_subgroup_id)
SELECT 
  'Learner_' || LPAD((n+50)::text, 3, '0'),
  'learner' || (n+50)::text || '@example.com',
  3,
  'learner',
  'active',
  2,
  3
FROM generate_series(1,50) AS n;

-- Periods for Intro to VR (program_id = 1)
INSERT INTO period (period_name, period_description, instructor_id, location_url, capacity, category)
SELECT 
  'VR Period ' || n,
  'Session ' || n || ' for Intro to VR program.',
  (SELECT id FROM "user" WHERE role_code = 'instructor' LIMIT 1),
  'http://vr.example.com/session' || n,
  20 + n,
  'virtual_reality'
FROM generate_series(1,10) AS n;

-- Periods for Data Science 101 (program_id = 2)
INSERT INTO period (period_name, period_description, instructor_id, location_url, capacity, category)
SELECT 
  'DS Period ' || n,
  'Session ' || n || ' for Data Science 101 program.',
  (SELECT id FROM "user" WHERE role_code = 'instructor' OFFSET 1 LIMIT 1),
  'http://ds.example.com/session' || n,
  25 + n,
  'learning_course'
FROM generate_series(1,10) AS n;