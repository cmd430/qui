package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"
)

// CustomThemesHandler handles custom theme operations
type CustomThemesHandler struct {
	db                  *sql.DB
	themeLicenseService interface {
		HasPremiumAccess(ctx context.Context) (bool, error)
	}
}

// NewCustomThemesHandler creates a new CustomThemesHandler
func NewCustomThemesHandler(db *sql.DB) *CustomThemesHandler {
	return &CustomThemesHandler{
		db: db,
	}
}

// SetThemeLicenseService sets the theme license service for premium check
func (h *CustomThemesHandler) SetThemeLicenseService(service interface {
	HasPremiumAccess(ctx context.Context) (bool, error)
}) {
	h.themeLicenseService = service
}

// CustomTheme represents a user-created theme
type CustomTheme struct {
	ID           int                       `json:"id"`
	Name         string                    `json:"name"`
	Description  string                    `json:"description"`
	BaseThemeID  string                    `json:"baseThemeId"`
	CSSVarsLight map[string]string         `json:"cssVarsLight"`
	CSSVarsDark  map[string]string         `json:"cssVarsDark"`
	CreatedAt    string                    `json:"createdAt"`
	UpdatedAt    string                    `json:"updatedAt"`
}

// CreateThemeRequest represents the request to create a new theme
type CreateThemeRequest struct {
	Name         string            `json:"name"`
	Description  string            `json:"description"`
	BaseThemeID  string            `json:"baseThemeId"`
	CSSVarsLight map[string]string `json:"cssVarsLight"`
	CSSVarsDark  map[string]string `json:"cssVarsDark"`
}

// UpdateThemeRequest represents the request to update a theme
type UpdateThemeRequest struct {
	Name         string            `json:"name"`
	Description  string            `json:"description"`
	CSSVarsLight map[string]string `json:"cssVarsLight"`
	CSSVarsDark  map[string]string `json:"cssVarsDark"`
}

// Routes registers the custom theme routes
func (h *CustomThemesHandler) Routes() chi.Router {
	r := chi.NewRouter()
	
	r.Get("/", h.ListThemes)
	r.Post("/", h.CreateTheme)
	r.Get("/{id}", h.GetTheme)
	r.Put("/{id}", h.UpdateTheme)
	r.Delete("/{id}", h.DeleteTheme)
	r.Post("/{id}/duplicate", h.DuplicateTheme)
	r.Post("/import", h.ImportTheme)
	r.Get("/{id}/export", h.ExportTheme)
	
	return r
}

// checkPremium verifies the user has premium access
func (h *CustomThemesHandler) checkPremium(w http.ResponseWriter, r *http.Request) bool {
	if h.themeLicenseService == nil {
		return true // No license service configured, allow access
	}
	
	hasPremium, err := h.themeLicenseService.HasPremiumAccess(r.Context())
	if err != nil {
		log.Error().Err(err).Msg("Failed to check premium access")
		http.Error(w, "Failed to verify premium access", http.StatusInternalServerError)
		return false
	}
	
	if !hasPremium {
		http.Error(w, "Premium feature - valid license required", http.StatusForbidden)
		return false
	}
	
	return true
}

// ListThemes returns all custom themes
func (h *CustomThemesHandler) ListThemes(w http.ResponseWriter, r *http.Request) {
	if !h.checkPremium(w, r) {
		return
	}
	
	rows, err := h.db.Query(`
		SELECT id, name, description, base_theme_id, css_vars_light, css_vars_dark, created_at, updated_at
		FROM custom_themes
		ORDER BY name
	`)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list custom themes")
		http.Error(w, "Failed to list themes", http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	
	themes := []CustomTheme{}
	for rows.Next() {
		var theme CustomTheme
		var cssVarsLightJSON, cssVarsDarkJSON string
		
		err := rows.Scan(
			&theme.ID,
			&theme.Name,
			&theme.Description,
			&theme.BaseThemeID,
			&cssVarsLightJSON,
			&cssVarsDarkJSON,
			&theme.CreatedAt,
			&theme.UpdatedAt,
		)
		if err != nil {
			log.Error().Err(err).Msg("Failed to scan theme row")
			continue
		}
		
		if err := json.Unmarshal([]byte(cssVarsLightJSON), &theme.CSSVarsLight); err != nil {
			log.Error().Err(err).Msg("Failed to unmarshal light CSS vars")
			continue
		}
		
		if err := json.Unmarshal([]byte(cssVarsDarkJSON), &theme.CSSVarsDark); err != nil {
			log.Error().Err(err).Msg("Failed to unmarshal dark CSS vars")
			continue
		}
		
		themes = append(themes, theme)
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(themes)
}

// GetTheme returns a specific custom theme
func (h *CustomThemesHandler) GetTheme(w http.ResponseWriter, r *http.Request) {
	if !h.checkPremium(w, r) {
		return
	}
	
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid theme ID", http.StatusBadRequest)
		return
	}
	
	var theme CustomTheme
	var cssVarsLightJSON, cssVarsDarkJSON string
	
	err = h.db.QueryRow(`
		SELECT id, name, description, base_theme_id, css_vars_light, css_vars_dark, created_at, updated_at
		FROM custom_themes
		WHERE id = ?
	`, id).Scan(
		&theme.ID,
		&theme.Name,
		&theme.Description,
		&theme.BaseThemeID,
		&cssVarsLightJSON,
		&cssVarsDarkJSON,
		&theme.CreatedAt,
		&theme.UpdatedAt,
	)
	
	if err == sql.ErrNoRows {
		http.Error(w, "Theme not found", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Error().Err(err).Msg("Failed to get custom theme")
		http.Error(w, "Failed to get theme", http.StatusInternalServerError)
		return
	}
	
	if err := json.Unmarshal([]byte(cssVarsLightJSON), &theme.CSSVarsLight); err != nil {
		log.Error().Err(err).Msg("Failed to unmarshal light CSS vars")
		http.Error(w, "Failed to parse theme data", http.StatusInternalServerError)
		return
	}
	
	if err := json.Unmarshal([]byte(cssVarsDarkJSON), &theme.CSSVarsDark); err != nil {
		log.Error().Err(err).Msg("Failed to unmarshal dark CSS vars")
		http.Error(w, "Failed to parse theme data", http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(theme)
}

// CreateTheme creates a new custom theme
func (h *CustomThemesHandler) CreateTheme(w http.ResponseWriter, r *http.Request) {
	if !h.checkPremium(w, r) {
		return
	}
	
	var req CreateThemeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	// Validate required fields
	if req.Name == "" {
		http.Error(w, "Theme name is required", http.StatusBadRequest)
		return
	}
	if req.BaseThemeID == "" {
		http.Error(w, "Base theme ID is required", http.StatusBadRequest)
		return
	}
	if len(req.CSSVarsLight) == 0 || len(req.CSSVarsDark) == 0 {
		http.Error(w, "CSS variables are required", http.StatusBadRequest)
		return
	}
	
	cssVarsLightJSON, err := json.Marshal(req.CSSVarsLight)
	if err != nil {
		log.Error().Err(err).Msg("Failed to marshal light CSS vars")
		http.Error(w, "Failed to process theme data", http.StatusInternalServerError)
		return
	}
	
	cssVarsDarkJSON, err := json.Marshal(req.CSSVarsDark)
	if err != nil {
		log.Error().Err(err).Msg("Failed to marshal dark CSS vars")
		http.Error(w, "Failed to process theme data", http.StatusInternalServerError)
		return
	}
	
	result, err := h.db.Exec(`
		INSERT INTO custom_themes (name, description, base_theme_id, css_vars_light, css_vars_dark)
		VALUES (?, ?, ?, ?, ?)
	`, req.Name, req.Description, req.BaseThemeID, string(cssVarsLightJSON), string(cssVarsDarkJSON))
	
	if err != nil {
		log.Error().Err(err).Msg("Failed to create custom theme")
		if err.Error() == "UNIQUE constraint failed: custom_themes.name" {
			http.Error(w, "A theme with this name already exists", http.StatusConflict)
		} else {
			http.Error(w, "Failed to create theme", http.StatusInternalServerError)
		}
		return
	}
	
	id, err := result.LastInsertId()
	if err != nil {
		log.Error().Err(err).Msg("Failed to get last insert ID")
		http.Error(w, "Failed to create theme", http.StatusInternalServerError)
		return
	}
	
	// Return the created theme
	theme := CustomTheme{
		ID:           int(id),
		Name:         req.Name,
		Description:  req.Description,
		BaseThemeID:  req.BaseThemeID,
		CSSVarsLight: req.CSSVarsLight,
		CSSVarsDark:  req.CSSVarsDark,
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(theme)
}

// UpdateTheme updates an existing custom theme
func (h *CustomThemesHandler) UpdateTheme(w http.ResponseWriter, r *http.Request) {
	if !h.checkPremium(w, r) {
		return
	}
	
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid theme ID", http.StatusBadRequest)
		return
	}
	
	var req UpdateThemeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	// Validate required fields
	if req.Name == "" {
		http.Error(w, "Theme name is required", http.StatusBadRequest)
		return
	}
	if len(req.CSSVarsLight) == 0 || len(req.CSSVarsDark) == 0 {
		http.Error(w, "CSS variables are required", http.StatusBadRequest)
		return
	}
	
	cssVarsLightJSON, err := json.Marshal(req.CSSVarsLight)
	if err != nil {
		log.Error().Err(err).Msg("Failed to marshal light CSS vars")
		http.Error(w, "Failed to process theme data", http.StatusInternalServerError)
		return
	}
	
	cssVarsDarkJSON, err := json.Marshal(req.CSSVarsDark)
	if err != nil {
		log.Error().Err(err).Msg("Failed to marshal dark CSS vars")
		http.Error(w, "Failed to process theme data", http.StatusInternalServerError)
		return
	}
	
	result, err := h.db.Exec(`
		UPDATE custom_themes
		SET name = ?, description = ?, css_vars_light = ?, css_vars_dark = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, req.Name, req.Description, string(cssVarsLightJSON), string(cssVarsDarkJSON), id)
	
	if err != nil {
		log.Error().Err(err).Msg("Failed to update custom theme")
		if err.Error() == "UNIQUE constraint failed: custom_themes.name" {
			http.Error(w, "A theme with this name already exists", http.StatusConflict)
		} else {
			http.Error(w, "Failed to update theme", http.StatusInternalServerError)
		}
		return
	}
	
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		log.Error().Err(err).Msg("Failed to get rows affected")
		http.Error(w, "Failed to update theme", http.StatusInternalServerError)
		return
	}
	
	if rowsAffected == 0 {
		http.Error(w, "Theme not found", http.StatusNotFound)
		return
	}
	
	w.WriteHeader(http.StatusNoContent)
}

// DeleteTheme deletes a custom theme
func (h *CustomThemesHandler) DeleteTheme(w http.ResponseWriter, r *http.Request) {
	if !h.checkPremium(w, r) {
		return
	}
	
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid theme ID", http.StatusBadRequest)
		return
	}
	
	result, err := h.db.Exec(`DELETE FROM custom_themes WHERE id = ?`, id)
	if err != nil {
		log.Error().Err(err).Msg("Failed to delete custom theme")
		http.Error(w, "Failed to delete theme", http.StatusInternalServerError)
		return
	}
	
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		log.Error().Err(err).Msg("Failed to get rows affected")
		http.Error(w, "Failed to delete theme", http.StatusInternalServerError)
		return
	}
	
	if rowsAffected == 0 {
		http.Error(w, "Theme not found", http.StatusNotFound)
		return
	}
	
	w.WriteHeader(http.StatusNoContent)
}

// DuplicateTheme creates a copy of an existing theme
func (h *CustomThemesHandler) DuplicateTheme(w http.ResponseWriter, r *http.Request) {
	if !h.checkPremium(w, r) {
		return
	}
	
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid theme ID", http.StatusBadRequest)
		return
	}
	
	// Get the original theme
	var originalTheme CustomTheme
	var cssVarsLightJSON, cssVarsDarkJSON string
	
	err = h.db.QueryRow(`
		SELECT name, description, base_theme_id, css_vars_light, css_vars_dark
		FROM custom_themes
		WHERE id = ?
	`, id).Scan(
		&originalTheme.Name,
		&originalTheme.Description,
		&originalTheme.BaseThemeID,
		&cssVarsLightJSON,
		&cssVarsDarkJSON,
	)
	
	if err == sql.ErrNoRows {
		http.Error(w, "Theme not found", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Error().Err(err).Msg("Failed to get original theme")
		http.Error(w, "Failed to duplicate theme", http.StatusInternalServerError)
		return
	}
	
	// Generate a unique name for the copy
	newName := originalTheme.Name + " (Copy)"
	nameCounter := 1
	for {
		var exists bool
		err := h.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM custom_themes WHERE name = ?)`, newName).Scan(&exists)
		if err != nil {
			log.Error().Err(err).Msg("Failed to check theme name existence")
			http.Error(w, "Failed to duplicate theme", http.StatusInternalServerError)
			return
		}
		if !exists {
			break
		}
		nameCounter++
		newName = originalTheme.Name + " (Copy " + strconv.Itoa(nameCounter) + ")"
	}
	
	// Create the duplicate
	result, err := h.db.Exec(`
		INSERT INTO custom_themes (name, description, base_theme_id, css_vars_light, css_vars_dark)
		VALUES (?, ?, ?, ?, ?)
	`, newName, originalTheme.Description, originalTheme.BaseThemeID, cssVarsLightJSON, cssVarsDarkJSON)
	
	if err != nil {
		log.Error().Err(err).Msg("Failed to create duplicate theme")
		http.Error(w, "Failed to duplicate theme", http.StatusInternalServerError)
		return
	}
	
	newID, err := result.LastInsertId()
	if err != nil {
		log.Error().Err(err).Msg("Failed to get last insert ID")
		http.Error(w, "Failed to duplicate theme", http.StatusInternalServerError)
		return
	}
	
	// Parse CSS vars for response
	var cssVarsLight, cssVarsDark map[string]string
	json.Unmarshal([]byte(cssVarsLightJSON), &cssVarsLight)
	json.Unmarshal([]byte(cssVarsDarkJSON), &cssVarsDark)
	
	// Return the duplicated theme
	duplicatedTheme := CustomTheme{
		ID:           int(newID),
		Name:         newName,
		Description:  originalTheme.Description,
		BaseThemeID:  originalTheme.BaseThemeID,
		CSSVarsLight: cssVarsLight,
		CSSVarsDark:  cssVarsDark,
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(duplicatedTheme)
}

// ImportTheme imports a theme from JSON
func (h *CustomThemesHandler) ImportTheme(w http.ResponseWriter, r *http.Request) {
	if !h.checkPremium(w, r) {
		return
	}
	
	var req CreateThemeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid theme JSON", http.StatusBadRequest)
		return
	}
	
	// Validate required fields
	if req.Name == "" {
		http.Error(w, "Theme name is required", http.StatusBadRequest)
		return
	}
	if req.BaseThemeID == "" {
		req.BaseThemeID = "minimal" // Default to minimal if not specified
	}
	if len(req.CSSVarsLight) == 0 || len(req.CSSVarsDark) == 0 {
		http.Error(w, "CSS variables are required", http.StatusBadRequest)
		return
	}
	
	// Check if name already exists and generate unique name if needed
	originalName := req.Name
	nameCounter := 1
	for {
		var exists bool
		err := h.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM custom_themes WHERE name = ?)`, req.Name).Scan(&exists)
		if err != nil {
			log.Error().Err(err).Msg("Failed to check theme name existence")
			http.Error(w, "Failed to import theme", http.StatusInternalServerError)
			return
		}
		if !exists {
			break
		}
		req.Name = originalName + " (" + strconv.Itoa(nameCounter) + ")"
		nameCounter++
	}
	
	// Create the theme
	cssVarsLightJSON, _ := json.Marshal(req.CSSVarsLight)
	cssVarsDarkJSON, _ := json.Marshal(req.CSSVarsDark)
	
	result, err := h.db.Exec(`
		INSERT INTO custom_themes (name, description, base_theme_id, css_vars_light, css_vars_dark)
		VALUES (?, ?, ?, ?, ?)
	`, req.Name, req.Description, req.BaseThemeID, string(cssVarsLightJSON), string(cssVarsDarkJSON))
	
	if err != nil {
		log.Error().Err(err).Msg("Failed to import theme")
		http.Error(w, "Failed to import theme", http.StatusInternalServerError)
		return
	}
	
	id, _ := result.LastInsertId()
	
	// Return the imported theme
	theme := CustomTheme{
		ID:           int(id),
		Name:         req.Name,
		Description:  req.Description,
		BaseThemeID:  req.BaseThemeID,
		CSSVarsLight: req.CSSVarsLight,
		CSSVarsDark:  req.CSSVarsDark,
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(theme)
}

// ExportTheme exports a theme as JSON
func (h *CustomThemesHandler) ExportTheme(w http.ResponseWriter, r *http.Request) {
	if !h.checkPremium(w, r) {
		return
	}
	
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		http.Error(w, "Invalid theme ID", http.StatusBadRequest)
		return
	}
	
	var theme CreateThemeRequest
	var cssVarsLightJSON, cssVarsDarkJSON string
	
	err = h.db.QueryRow(`
		SELECT name, description, base_theme_id, css_vars_light, css_vars_dark
		FROM custom_themes
		WHERE id = ?
	`, id).Scan(
		&theme.Name,
		&theme.Description,
		&theme.BaseThemeID,
		&cssVarsLightJSON,
		&cssVarsDarkJSON,
	)
	
	if err == sql.ErrNoRows {
		http.Error(w, "Theme not found", http.StatusNotFound)
		return
	}
	if err != nil {
		log.Error().Err(err).Msg("Failed to get theme for export")
		http.Error(w, "Failed to export theme", http.StatusInternalServerError)
		return
	}
	
	json.Unmarshal([]byte(cssVarsLightJSON), &theme.CSSVarsLight)
	json.Unmarshal([]byte(cssVarsDarkJSON), &theme.CSSVarsDark)
	
	// Set headers for file download
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", `attachment; filename="`+theme.Name+`.json"`)
	
	json.NewEncoder(w).Encode(theme)
}