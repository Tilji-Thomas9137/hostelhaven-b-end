-- ============================================================================
-- ADDITIONAL ADMISSION REGISTRY ENTRIES FOR TESTING
-- ============================================================================
-- Add these entries if you want to test student creation workflow
-- Run this BEFORE running the test-data-seed.sql script
-- ============================================================================

-- Add additional admission registry entries for testing student creation
INSERT INTO admission_registry (admission_number, student_name, course, batch_year, parent_name, parent_email, parent_phone) VALUES
('ADM011', 'Test Student One', 'Computer Science', 2024, 'Test Parent One', 'testparent1@email.com', '+1234567900'),
('ADM012', 'Test Student Two', 'Electrical Engineering', 2024, 'Test Parent Two', 'testparent2@email.com', '+1234567901'),
('ADM013', 'Test Student Three', 'Mechanical Engineering', 2024, 'Test Parent Three', 'testparent3@email.com', '+1234567902'),
('ADM014', 'Test Student Four', 'Civil Engineering', 2024, 'Test Parent Four', 'testparent4@email.com', '+1234567903'),
('ADM015', 'Test Student Five', 'Business Administration', 2024, 'Test Parent Five', 'testparent5@email.com', '+1234567904');

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Additional admission registry entries added successfully!';
    RAISE NOTICE 'You can now test student creation with admission numbers ADM011-ADM015';
END $$;
