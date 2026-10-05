-- Widen course codes and their mapping columns while preserving existing course references.
ALTER TABLE `inst_course`
  DROP FOREIGN KEY `inst_course_course_code_fkey`;

ALTER TABLE `course_subject`
  DROP FOREIGN KEY `course_subject_course_code_fkey`;

ALTER TABLE `course`
  MODIFY COLUMN `course_code` VARCHAR(191) NOT NULL;

ALTER TABLE `inst_course`
  MODIFY COLUMN `course_code` VARCHAR(191) NOT NULL;

ALTER TABLE `course_subject`
  MODIFY COLUMN `course_code` VARCHAR(191) NOT NULL;

ALTER TABLE `inst_course`
  ADD CONSTRAINT `inst_course_course_code_fkey`
  FOREIGN KEY (`course_code`) REFERENCES `course` (`course_code`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `course_subject`
  ADD CONSTRAINT `course_subject_course_code_fkey`
  FOREIGN KEY (`course_code`) REFERENCES `course` (`course_code`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
