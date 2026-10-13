-- CreateTable
CREATE TABLE `institute` (
    `inst_short_name` VARCHAR(10) NOT NULL,
    `inst_full_name` VARCHAR(100) NULL,
    `inst_Address1` VARCHAR(100) NULL,
    `inst_Address2` VARCHAR(100) NULL,
    `inst_District` VARCHAR(50) NULL,
    `inst_State` VARCHAR(50) NULL,
    `Landline_PhoneNo` VARCHAR(20) NULL,
    `Director_Name` VARCHAR(50) NULL,
    `Director_Desig` VARCHAR(25) NULL,
    `Director_Email` VARCHAR(50) NULL,
    `Director_MobileNo` VARCHAR(10) NULL,
    `ExamHead_Name` VARCHAR(50) NULL,
    `ExamHead_Desig` VARCHAR(25) NULL,
    `ExamHead_Email` VARCHAR(50) NULL,
    `ExamHead_MobileNo` VARCHAR(10) NULL,

    PRIMARY KEY (`inst_short_name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `user_name` VARCHAR(10) NOT NULL,
    `role` VARCHAR(5) NOT NULL,
    `password` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`user_name`, `role`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `course` (
    `course_code` VARCHAR(3) NOT NULL,
    `course_short_name` VARCHAR(10) NULL,
    `course_full_name` VARCHAR(100) NULL,

    PRIMARY KEY (`course_code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `specialization` (
    `spec_id` TINYINT NOT NULL,
    `spec_name` VARCHAR(30) NULL,

    PRIMARY KEY (`spec_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subject` (
    `subject_code` VARCHAR(10) NOT NULL,
    `sub_subject_codes` VARCHAR(100) NULL,
    `subject_short_name` VARCHAR(10) NULL,
    `subject_full_name` VARCHAR(100) NULL,
    `semester` TINYINT NULL,
    `spec_id` TINYINT NULL,

    PRIMARY KEY (`subject_code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inst_course` (
    `inst_short_name` VARCHAR(10) NOT NULL,
    `course_code` VARCHAR(3) NOT NULL,
    `intake` SMALLINT NULL,
    `strength` SMALLINT NULL,

    PRIMARY KEY (`inst_short_name`, `course_code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `course_subject` (
    `course_code` VARCHAR(3) NOT NULL,
    `subject_code` VARCHAR(10) NOT NULL,
    `study_year` TINYINT NULL,
    `semester` TINYINT NULL,

    PRIMARY KEY (`course_code`, `subject_code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `faculty` (
    `PAN` VARCHAR(10) NOT NULL,
    `Title` VARCHAR(10) NULL,
    `faculty_name` VARCHAR(50) NULL,
    `inst_short_name` VARCHAR(10) NULL,
    `faculty_desig` VARCHAR(25) NULL,
    `faculty_total_exp` SMALLINT NULL,
    `faculty_address` VARCHAR(100) NULL,
    `faculty_Email` VARCHAR(50) NULL,
    `faculty_MobileNo` VARCHAR(10) NULL,
    `entered_by` VARCHAR(10) NULL,
    `entered_on` DATETIME(3) NULL,

    PRIMARY KEY (`PAN`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `faculty_subject` (
    `PAN` VARCHAR(10) NOT NULL,
    `subject_code` VARCHAR(10) NOT NULL,
    `entered_by` VARCHAR(10) NULL,
    `entered_on` DATETIME(3) NULL,

    PRIMARY KEY (`PAN`, `subject_code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `faculty_spec` (
    `PAN` VARCHAR(10) NOT NULL,
    `spec_id` TINYINT NOT NULL,
    `entered_by` VARCHAR(10) NULL,
    `entered_on` DATETIME(3) NULL,

    PRIMARY KEY (`PAN`, `spec_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `subject` ADD CONSTRAINT `subject_spec_id_fkey` FOREIGN KEY (`spec_id`) REFERENCES `specialization`(`spec_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inst_course` ADD CONSTRAINT `inst_course_inst_short_name_fkey` FOREIGN KEY (`inst_short_name`) REFERENCES `institute`(`inst_short_name`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inst_course` ADD CONSTRAINT `inst_course_course_code_fkey` FOREIGN KEY (`course_code`) REFERENCES `course`(`course_code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_subject` ADD CONSTRAINT `course_subject_course_code_fkey` FOREIGN KEY (`course_code`) REFERENCES `course`(`course_code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `course_subject` ADD CONSTRAINT `course_subject_subject_code_fkey` FOREIGN KEY (`subject_code`) REFERENCES `subject`(`subject_code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `faculty` ADD CONSTRAINT `faculty_inst_short_name_fkey` FOREIGN KEY (`inst_short_name`) REFERENCES `institute`(`inst_short_name`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `faculty_subject` ADD CONSTRAINT `faculty_subject_PAN_fkey` FOREIGN KEY (`PAN`) REFERENCES `faculty`(`PAN`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `faculty_subject` ADD CONSTRAINT `faculty_subject_subject_code_fkey` FOREIGN KEY (`subject_code`) REFERENCES `subject`(`subject_code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `faculty_spec` ADD CONSTRAINT `faculty_spec_PAN_fkey` FOREIGN KEY (`PAN`) REFERENCES `faculty`(`PAN`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `faculty_spec` ADD CONSTRAINT `faculty_spec_spec_id_fkey` FOREIGN KEY (`spec_id`) REFERENCES `specialization`(`spec_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
