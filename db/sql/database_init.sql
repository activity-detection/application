\c activitydetectordb

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE videos (
    video_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_name VARCHAR(255) NOT NULL,
    description TEXT,
    upload_date TIMESTAMP NOT NULL DEFAULT NOW(),
    video_path VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE video_details(
    video_id UUID PRIMARY KEY,
    details_json JSONB,
    CONSTRAINT fk_videos_video_detections FOREIGN KEY (video_id) REFERENCES videos(video_id) ON DELETE CASCADE
);

CREATE TABLE detection_templates (
    id SERIAL PRIMARY KEY,
    detection_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE detection_elements (
    id SERIAL PRIMARY KEY,
    element_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE detection_vectors (
    id SERIAL PRIMARY KEY,
    detection_template_id INT NOT NULL,
    CONSTRAINT fk_vector_template FOREIGN KEY (detection_template_id) REFERENCES detection_templates(id)
);

CREATE TABLE detection_rule (
    detection_vector_id INT NOT NULL,
    detection_element_id INT NOT NULL,
    is_range BOOLEAN GENERATED ALWAYS AS (count IS NULL) STORED,
    count SMALLINT,
    count_from SMALLINT,
    count_to SMALLINT,
    PRIMARY KEY (detection_vector_id, detection_element_id),
    CONSTRAINT fk_rule_vector FOREIGN KEY (detection_vector_id) REFERENCES detection_vectors(id),
    CONSTRAINT fk_rule_element FOREIGN KEY (detection_element_id) REFERENCES detection_elements(id),

    CHECK(
        (count IS NOT NULL AND count_from IS NULL AND count_to IS NULL)
            OR
        (count IS NULL AND (count_from IS NOT NULL OR count_to IS NOT NULL))
        )
)