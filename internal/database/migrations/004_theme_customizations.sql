-- Theme color customizations for premium users
-- Stores user's custom color overrides per theme
CREATE TABLE IF NOT EXISTS theme_customizations (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Single user = single record
    color_overrides TEXT, -- JSON blob with theme-specific color overrides
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to update the updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_theme_customizations_updated_at 
AFTER UPDATE ON theme_customizations
BEGIN
    UPDATE theme_customizations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;