-- Add TQM (Torrent Queue Manager) support
-- Add TQM enabled flag to instances table
ALTER TABLE instances ADD COLUMN tqm_enabled BOOLEAN DEFAULT 0;

-- TQM filter configurations per instance
CREATE TABLE IF NOT EXISTS tqm_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    enabled BOOLEAN DEFAULT 1,
    filters_json TEXT NOT NULL, -- JSON array of filter configurations
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
);

-- TQM tag rules per configuration
CREATE TABLE IF NOT EXISTS tqm_tag_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_id INTEGER NOT NULL,
    name TEXT NOT NULL, -- Tag name to apply
    mode TEXT NOT NULL CHECK (mode IN ('add', 'remove', 'full')), -- Tag application mode
    expression TEXT NOT NULL, -- Filter expression (e.g., "IsUnregistered()")
    upload_kb INTEGER, -- Optional upload speed limit in KB/s
    enabled BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (config_id) REFERENCES tqm_configs(id) ON DELETE CASCADE
);

-- TQM operation history for tracking retag runs
CREATE TABLE IF NOT EXISTS tqm_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id INTEGER NOT NULL,
    operation_type TEXT NOT NULL, -- 'retag', 'remove', etc.
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    torrents_processed INTEGER DEFAULT 0,
    tags_applied INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_tqm_configs_instance ON tqm_configs(instance_id);
CREATE INDEX IF NOT EXISTS idx_tqm_tag_rules_config ON tqm_tag_rules(config_id);
CREATE INDEX IF NOT EXISTS idx_tqm_operations_instance ON tqm_operations(instance_id);
CREATE INDEX IF NOT EXISTS idx_tqm_operations_status ON tqm_operations(status);

-- Triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_tqm_configs_updated_at 
AFTER UPDATE ON tqm_configs
BEGIN
    UPDATE tqm_configs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_tqm_tag_rules_updated_at 
AFTER UPDATE ON tqm_tag_rules
BEGIN
    UPDATE tqm_tag_rules SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Insert default TQM configuration for existing instances
INSERT INTO tqm_configs (instance_id, name, filters_json)
SELECT 
    id,
    'Default TQM Config',
    '[{"name": "unregistered", "mode": "full", "expression": "IsUnregistered()", "enabled": true}, {"name": "tracker-down", "mode": "full", "expression": "IsTrackerDown()", "enabled": true}]'
FROM instances;

-- Insert default tag rules for the default configurations
INSERT INTO tqm_tag_rules (config_id, name, mode, expression)
SELECT 
    tc.id,
    'unregistered',
    'full',
    'IsUnregistered()'
FROM tqm_configs tc WHERE tc.name = 'Default TQM Config';

INSERT INTO tqm_tag_rules (config_id, name, mode, expression)
SELECT 
    tc.id,
    'tracker-down',
    'full',
    'IsTrackerDown()'
FROM tqm_configs tc WHERE tc.name = 'Default TQM Config';