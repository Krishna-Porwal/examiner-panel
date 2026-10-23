-- Create missing institute-course-subject mapping table
CREATE TABLE `inst_course_subject` (
    `inst_short_name` VARCHAR(10) NOT NULL,
    `course_code` VARCHAR(191) NOT NULL,
    `subject_code` VARCHAR(10) NOT NULL,

    PRIMARY KEY (`inst_short_name`, `course_code`, `subject_code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add foreign keys
ALTER TABLE `inst_course_subject`
    ADD CONSTRAINT `inst_course_subject_inst_short_name_fkey`
    FOREIGN KEY (`inst_short_name`) REFERENCES `institute` (`inst_short_name`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `inst_course_subject`
    ADD CONSTRAINT `inst_course_subject_course_code_fkey`
    FOREIGN KEY (`course_code`) REFERENCES `course` (`course_code`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `inst_course_subject`
    ADD CONSTRAINT `inst_course_subject_subject_code_fkey`
    FOREIGN KEY (`subject_code`) REFERENCES `subject` (`subject_code`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
