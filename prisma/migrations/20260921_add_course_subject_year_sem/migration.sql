-- Add study_year and semester to course_subject without dropping data
ALTER TABLE `course_subject`
  ADD COLUMN IF NOT EXISTS `study_year` TINYINT NULL,
  ADD COLUMN IF NOT EXISTS `semester` TINYINT NULL;

-- Backfill plan (no automatic backfill performed here). Consider migrating existing Subject.semester if appropriate.
