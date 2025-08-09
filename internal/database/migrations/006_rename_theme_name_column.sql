-- Rename theme_name to product_name to better reflect its purpose
-- The field stores the Polar product name (e.g., "premium-access")
ALTER TABLE theme_licenses RENAME COLUMN theme_name TO product_name;

-- Update the index name for consistency
DROP INDEX IF EXISTS idx_theme_licenses_theme;
CREATE INDEX idx_theme_licenses_product ON theme_licenses(product_name);