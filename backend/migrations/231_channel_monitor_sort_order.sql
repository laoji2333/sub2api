ALTER TABLE channel_monitors
    ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_channel_monitors_enabled_sort_order_id
    ON channel_monitors (enabled DESC, sort_order ASC, id ASC);
