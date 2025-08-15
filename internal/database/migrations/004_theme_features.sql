-- Theme customization features for premium users
-- Combines theme customizations, custom themes, and column rename

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

-- Rename theme_name to product_name to better reflect its purpose
-- The field stores the Polar product name (e.g., "premium-access")
ALTER TABLE theme_licenses RENAME COLUMN theme_name TO product_name;

-- Update the index name for consistency
DROP INDEX IF EXISTS idx_theme_licenses_theme;
CREATE INDEX idx_theme_licenses_product ON theme_licenses(product_name);