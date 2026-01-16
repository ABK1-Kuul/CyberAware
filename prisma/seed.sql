-- CyberAware Database Seed Data
-- This file contains the initial data converted from mock data
-- Import this after running migrations: mysql -u your_user -p your_database < prisma/seed.sql

-- Disable foreign key checks temporarily for clean import
SET FOREIGN_KEY_CHECKS = 0;

-- Clear existing data (optional, for clean re-seeding)
TRUNCATE TABLE `audit_logs`;
TRUNCATE TABLE `certificates`;
TRUNCATE TABLE `scorm_data`;
TRUNCATE TABLE `enrollments`;
TRUNCATE TABLE `courses`;
TRUNCATE TABLE `users`;

-- Enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Insert Users
-- Note: Dates are calculated relative to current timestamp
INSERT INTO `users` (`id`, `name`, `email`, `role`, `team`, `created_at`, `avatar_url`) VALUES
('usr_1', 'Alice Johnson', 'alice@example.com', 'learner', 'Sales', DATE_SUB(NOW(), INTERVAL 25 DAY), 'https://picsum.photos/seed/usr_1/100/100'),
('usr_2', 'Bob Williams', 'bob@example.com', 'learner', 'Engineering', DATE_SUB(NOW(), INTERVAL 45 DAY), 'https://picsum.photos/seed/usr_2/100/100'),
('usr_3', 'Charlie Brown', 'charlie@example.com', 'learner', 'Marketing', DATE_SUB(NOW(), INTERVAL 10 DAY), 'https://picsum.photos/seed/usr_3/100/100'),
('usr_4', 'Diana Prince', 'diana@example.com', 'learner', 'Engineering', DATE_SUB(NOW(), INTERVAL 80 DAY), 'https://picsum.photos/seed/usr_4/100/100'),
('usr_5', 'Ethan Hunt', 'ethan@example.com', 'learner', 'Sales', DATE_SUB(NOW(), INTERVAL 5 DAY), 'https://picsum.photos/seed/usr_5/100/100'),
('usr_admin', 'Admin User', 'admin@cyberaware.com', 'admin', 'IT', DATE_SUB(NOW(), INTERVAL 365 DAY), 'https://picsum.photos/seed/admin/100/100'),
('sys_gophish', 'GoPhish Hook', 'system@internal', 'admin', 'System', NOW(), '');

-- Insert Courses
INSERT INTO `courses` (`id`, `title`, `description`, `version`, `scorm_path`, `created_at`, `enrollment_count`) VALUES
('crs_1', 'Phishing Awareness 101', 'Learn to identify and report phishing attempts.', '1.2', '/scorm/phishing-101', DATE_SUB(NOW(), INTERVAL 60 DAY), 3),
('crs_2', 'Secure Password Practices', 'Create and manage strong, unique passwords.', '1.0', '/scorm/passwords-10', DATE_SUB(NOW(), INTERVAL 90 DAY), 2),
('crs_3', 'Social Engineering Defense', 'Recognize and thwart social engineering tactics.', '2.0', '/scorm/social-eng-20', DATE_SUB(NOW(), INTERVAL 30 DAY), 1),
('crs_4', 'Advanced Threat Protection', 'A deep dive into modern cyber threats for technical staff.', '1.5', '/scorm/adv-threat-15', DATE_SUB(NOW(), INTERVAL 120 DAY), 1);

-- Insert Enrollments
-- Note: Enum values in MySQL are stored as strings matching the Prisma enum names
INSERT INTO `enrollments` (`id`, `user_id`, `course_id`, `status`, `progress`, `assigned_at`, `completed_at`) VALUES
('enr_1', 'usr_1', 'crs_1', 'Completed', 100, DATE_SUB(NOW(), INTERVAL 20 DAY), DATE_SUB(NOW(), INTERVAL 18 DAY)),
('enr_2', 'usr_2', 'crs_1', 'InProgress', 50, DATE_SUB(NOW(), INTERVAL 15 DAY), NULL),
('enr_3', 'usr_3', 'crs_1', 'NotStarted', 0, DATE_SUB(NOW(), INTERVAL 5 DAY), NULL),
('enr_4', 'usr_1', 'crs_2', 'InProgress', 25, DATE_SUB(NOW(), INTERVAL 10 DAY), NULL),
('enr_5', 'usr_4', 'crs_2', 'Completed', 100, DATE_SUB(NOW(), INTERVAL 40 DAY), DATE_SUB(NOW(), INTERVAL 35 DAY)),
('enr_6', 'usr_5', 'crs_3', 'NotStarted', 0, DATE_SUB(NOW(), INTERVAL 2 DAY), NULL),
('enr_7', 'usr_2', 'crs_4', 'InProgress', 75, DATE_SUB(NOW(), INTERVAL 60 DAY), NULL);

-- Insert Certificates
INSERT INTO `certificates` (`id`, `enrollment_id`, `path`, `issued_at`, `uuid`) VALUES
('cert_1', 'enr_1', '/certs/cert_1.pdf', DATE_SUB(NOW(), INTERVAL 18 DAY), 'f47ac10b-58cc-4372-a567-0e02b2c3d479'),
('cert_2', 'enr_5', '/certs/cert_2.pdf', DATE_SUB(NOW(), INTERVAL 35 DAY), 'a1b2c3d4-e5f6-7890-1234-567890abcdef');

-- Insert Audit Logs
INSERT INTO `audit_logs` (`id`, `actor_id`, `action`, `details`, `created_at`) VALUES
('aud_1', 'usr_admin', 'Course Uploaded', '{"courseTitle": "Advanced Threat Protection"}', DATE_SUB(NOW(), INTERVAL 120 DAY)),
('aud_2', 'usr_admin', 'User Assigned', '{"user": "Alice Johnson", "course": "Phishing Awareness 101"}', DATE_SUB(NOW(), INTERVAL 20 DAY)),
('aud_3', 'usr_1', 'Course Completed', '{"courseTitle": "Phishing Awareness 101"}', DATE_SUB(NOW(), INTERVAL 18 DAY)),
('aud_4', 'sys_gophish', 'User Assigned (Auto)', '{"user": "Charlie Brown", "course": "Phishing Awareness 101", "reason": "Failed phishing test"}', DATE_SUB(NOW(), INTERVAL 5 DAY)),
('aud_5', 'usr_2', 'Course Started', '{"courseTitle": "Advanced Threat Protection"}', DATE_SUB(NOW(), INTERVAL 60 DAY));
