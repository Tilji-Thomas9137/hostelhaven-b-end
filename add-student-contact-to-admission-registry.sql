-- Adds student contact columns to admission_registry if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admission_registry' AND column_name = 'student_email'
  ) THEN
    ALTER TABLE admission_registry ADD COLUMN student_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admission_registry' AND column_name = 'student_phone'
  ) THEN
    ALTER TABLE admission_registry ADD COLUMN student_phone text;
  END IF;
END $$;


