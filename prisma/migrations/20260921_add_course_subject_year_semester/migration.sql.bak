-- Add nullable study_year and semester to course_subject without dropping any data
-- This migration is additive and safe: it only adds new nullable columns and backfills them
-- DO NOT RUN prisma migrate reset. Apply against a staging DB and verify before production.

ALTER TABLE `course_subject`
  ADD COLUMN `study_year` TINYINT NULL,
  ADD COLUMN `semester` TINYINT NULL;

-- Backfill values from subject.semester where available
-- study_year = CEIL(semester / 2)
UPDATE `course_subject` cs
  JOIN `subject` s ON cs.subject_code = s.subject_code
  SET cs.semester = s.semester,
      cs.study_year = CASE
        WHEN s.semester IS NULL THEN NULL
        WHEN s.semester <= 0 THEN NULL
        ELSE CEIL(s.semester / 2)
      END
  WHERE s.semester IS NOT NULL;

-- Note: do NOT drop the old subject.semester column here. Verify data, tests, and application behavior before considering cleanup.
