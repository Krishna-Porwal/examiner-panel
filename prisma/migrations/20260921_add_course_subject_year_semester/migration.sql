
-- The study_year and semester columns already exist.
-- Backfill course_subject from subject.semester where available.

UPDATE `course_subject` cs
JOIN `subject` s ON cs.subject_code = s.subject_code
SET
  cs.semester = s.semester,
  cs.study_year = CASE
    WHEN s.semester IS NULL THEN NULL
    WHEN s.semester <= 0 THEN NULL
    ELSE CEIL(s.semester / 2)
  END
WHERE s.semester IS NOT NULL;
