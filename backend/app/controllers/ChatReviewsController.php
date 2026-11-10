CREATE TABLE IF NOT EXISTS chat_photos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  assessment_id INT UNSIGNED NOT NULL,
  mime_type VARCHAR(50) NOT NULL,
  image_base64 MEDIUMTEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_chat_photo_assessment (assessment_id),
  CONSTRAINT fk_chat_photo_assessment FOREIGN KEY (assessment_id)
    REFERENCES chat_assessments(id) ON DELETE CASCADE
) ENGINE=InnoDB;