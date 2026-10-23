-- CreateTable
CREATE TABLE `inst_spec` (
    `inst_short_name` VARCHAR(10) NOT NULL,
    `spec_id` TINYINT NOT NULL,

    PRIMARY KEY (`inst_short_name`, `spec_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `inst_spec`
    ADD CONSTRAINT `inst_spec_inst_short_name_fkey`
    FOREIGN KEY (`inst_short_name`) REFERENCES `institute` (`inst_short_name`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inst_spec`
    ADD CONSTRAINT `inst_spec_spec_id_fkey`
    FOREIGN KEY (`spec_id`) REFERENCES `specialization` (`spec_id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
