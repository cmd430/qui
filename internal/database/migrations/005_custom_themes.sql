-- User-created custom themes
-- Stores complete theme configurations created by users
CREATE TABLE IF NOT EXISTS custom_themes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    base_theme_id TEXT NOT NULL, -- Which built-in theme it was based on
    css_vars_light TEXT NOT NULL, -- JSON with all light mode CSS variables
    css_vars_dark TEXT NOT NULL,  -- JSON with all dark mode CSS variables
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_custom_themes_name ON custom_themes(name);

-- Trigger to update the updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_custom_themes_updated_at 
AFTER UPDATE ON custom_themes
BEGIN
    UPDATE custom_themes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;