\c activitydetectordb

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE videos (
    video_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_name VARCHAR(255) NOT NULL,
    description TEXT,
    upload_date TIMESTAMP NOT NULL DEFAULT NOW(),
    video_path VARCHAR(255) NOT NULL UNIQUE,
    referenced_video_id UUID,
    origin_id UUID,
    CONSTRAINT fk_videos_refvideos FOREIGN KEY (referenced_video_id) REFERENCES videos(video_id)
);


CREATE OR REPLACE FUNCTION set_origin_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.referenced_video_id IS NULL THEN
        NEW.origin_id := NEW.video_id;
    ELSE
        SELECT origin_id INTO NEW.origin_id
        FROM videos
        WHERE video_id = NEW.referenced_video_id;

        IF NEW.origin_id IS NULL THEN
                    RAISE EXCEPTION 'Parent record with id % not found', NEW.referenced_video_id;
        END IF;
    END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_origin
    BEFORE INSERT ON videos
    FOR EACH ROW
    EXECUTE FUNCTION set_origin_id();

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
);

-- Forbidden areas: polygons drawn over a video frame in the UI, stored as
-- normalized [0..1] coordinates so they are resolution-independent and can be
-- scaled to the detector's live frame size. The detector polls these and
-- auto-records when a person enters one (synthetic "forbidden_zone" rule).
CREATE TABLE forbidden_zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    policy VARCHAR(20) NOT NULL DEFAULT 'forbidden',
    points JSONB NOT NULL,                 -- [[x,y],...] normalized 0..1, >= 3 points
    reference_video_id UUID,               -- the video the polygon was drawn over (optional)
    aspect_ratio REAL,                     -- w/h of the reference frame (UI sanity check)
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_zone_refvideo FOREIGN KEY (reference_video_id)
        REFERENCES videos(video_id) ON DELETE SET NULL
);