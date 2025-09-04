CREATE DATABASE IF NOT EXISTS scheduler;
USE scheduler;

-- Drop old tables if they exist
DROP TABLE IF EXISTS schedule_item;
DROP TABLE IF EXISTS period;
DROP TABLE IF EXISTS user;
DROP TABLE IF EXISTS system_role;
DROP TABLE IF EXISTS schedule;
DROP TABLE IF EXISTS program;
DROP TABLE IF EXISTS cohort_subgroup;
DROP TABLE IF EXISTS cohort;

-- ====================
-- Tables
-- ====================

CREATE TABLE cohort (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT
);

CREATE TABLE cohort_subgroup (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    cohort_id INT NOT NULL,
    FOREIGN KEY (cohort_id) REFERENCES cohort(id)
);

CREATE TABLE program (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT
);

CREATE TABLE schedule (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    program_id INT,
    cohort_id INT,
    subgroup_id INT,
    FOREIGN KEY (program_id) REFERENCES program(id),
    FOREIGN KEY (cohort_id) REFERENCES cohort(id),
    FOREIGN KEY (subgroup_id) REFERENCES cohort_subgroup(id)
);

CREATE TABLE system_role (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    code ENUM(
        'instructor',
        'learner',
        'admin',
        'replacement_instructor',
        'visiting_instructor'
    ) NOT NULL
);

CREATE TABLE user (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role_id INT NOT NULL,
    cohort_id INT,
    subgroup_id INT,
    status ENUM('active', 'inactive') NOT NULL,
    FOREIGN KEY (role_id) REFERENCES system_role(id),
    FOREIGN KEY (cohort_id) REFERENCES cohort(id),
    FOREIGN KEY (subgroup_id) REFERENCES cohort_subgroup(id)
);

CREATE TABLE period (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    instructor_id INT,
    location_url VARCHAR(512),
    capacity INT,
    category ENUM(
        'virtual_reality',
        'face_to_face',
        'assessment',
        'learning_course',
        'other'
    ) NOT NULL,
    FOREIGN KEY (instructor_id) REFERENCES user(id)
);

CREATE TABLE schedule_item (
    id INT AUTO_INCREMENT PRIMARY KEY,
    schedule_id INT NOT NULL,
    program_id INT,
    period_id INT,
    cohort_id INT,
    subgroup_id INT,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    FOREIGN KEY (schedule_id) REFERENCES schedule(id),
    FOREIGN KEY (program_id) REFERENCES program(id),
    FOREIGN KEY (period_id) REFERENCES period(id),
    FOREIGN KEY (cohort_id) REFERENCES cohort(id),
    FOREIGN KEY (subgroup_id) REFERENCES cohort_subgroup(id)
);

-- ====================
-- Seed Data
-- ====================

-- Roles
INSERT INTO system_role (name, description, code) VALUES
('Admin', 'System administrator', 'admin'),
('Instructor', 'Main instructor', 'instructor'),
('Learner', 'Student learner', 'learner'),
('Replacement Instructor', 'Backup instructor', 'replacement_instructor'),
('Visiting Instructor', 'Guest instructor', 'visiting_instructor');

-- Cohorts
INSERT INTO cohort (name, description) VALUES
('Cohort 1', 'First test cohort'),
('Cohort 2', 'Second test cohort');

-- Subgroups
INSERT INTO cohort_subgroup (name, cohort_id) VALUES
('Subgroup A', 1),
('Subgroup B', 1),
('Subgroup C', 2);

-- Programs
INSERT INTO program (name, description) VALUES
('Intro to VR', 'Virtual reality basics'),
('Data Science 101', 'Fundamentals of data science');

-- Admin user
INSERT INTO user (name, email, role_id, status) VALUES
('Admin User', 'admin@example.com', 1, 'active');

-- Instructors (5)
INSERT INTO user (name, email, role_id, status) VALUES
('Instructor 001', 'instructor001@example.com', 2, 'active'),
('Instructor 002', 'instructor002@example.com', 2, 'active'),
('Instructor 003', 'instructor003@example.com', 2, 'active'),
('Instructor 004', 'instructor004@example.com', 2, 'active'),
('Instructor 005', 'instructor005@example.com', 2, 'active');

-- Learners (50)
INSERT INTO user (name, email, role_id, status, cohort_id, subgroup_id)
SELECT CONCAT('Learner ', LPAD(n, 3, '0')),
       CONCAT('learner', LPAD(n, 3, '0'), '@example.com'),
       3, -- role_id = Learner
       'active',
       1, -- assign to Cohort 1
       CASE
           WHEN n % 2 = 0 THEN 1  -- subgroup A
           ELSE 2                 -- subgroup B
       END
FROM (
  SELECT 1 AS n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
  UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
  UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15
  UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20
  UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24 UNION SELECT 25
  UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29 UNION SELECT 30
  UNION SELECT 31 UNION SELECT 32 UNION SELECT 33 UNION SELECT 34 UNION SELECT 35
  UNION SELECT 36 UNION SELECT 37 UNION SELECT 38 UNION SELECT 39 UNION SELECT 40
  UNION SELECT 41 UNION SELECT 42 UNION SELECT 43 UNION SELECT 44 UNION SELECT 45
  UNION SELECT 46 UNION SELECT 47 UNION SELECT 48 UNION SELECT 49 UNION SELECT 50
) AS numbers;

-- Learners (additional 50) in Cohort 2, Subgroup C
INSERT INTO user (name, email, role_id, status, cohort_id, subgroup_id)
SELECT CONCAT('Learner_', LPAD(n, 3, '0') + 50),
       CONCAT('learner', LPAD(n, 3, '0') + 50, '@example.com'),
       3, -- learner role_id
       'active',
       2, -- Cohort 2
       3  -- Subgroup C
FROM (
  SELECT 1 AS n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
  UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
  UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15
  UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20
  UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24 UNION SELECT 25
  UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29 UNION SELECT 30
  UNION SELECT 31 UNION SELECT 32 UNION SELECT 33 UNION SELECT 34 UNION SELECT 35
  UNION SELECT 36 UNION SELECT 37 UNION SELECT 38 UNION SELECT 39 UNION SELECT 40
  UNION SELECT 41 UNION SELECT 42 UNION SELECT 43 UNION SELECT 44 UNION SELECT 45
  UNION SELECT 46 UNION SELECT 47 UNION SELECT 48 UNION SELECT 49 UNION SELECT 50
) AS numbers;