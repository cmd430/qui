package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"
)

// ThemeCustomizationsHandler handles theme color customization operations
type ThemeCustomizationsHandler struct {
	db                  *sql.DB
	themeLicenseService interface {
		HasPremiumAccess(ctx context.Context) (bool, error)
	}
}

// NewThemeCustomizationsHandler creates a new ThemeCustomizationsHandler
func NewThemeCustomizationsHandler(db *sql.DB) *ThemeCustomizationsHandler {
	return &ThemeCustomizationsHandler{
		db: db,
	}
}

// SetThemeLicenseService sets the theme license service for premium check
func (h *ThemeCustomizationsHandler) SetThemeLicenseService(service interface {
	HasPremiumAccess(ctx context.Context) (bool, error)
}) {
	h.themeLicenseService = service
}

// ColorOverrides represents the structure of color customizations
// Structure: theme_id -> mode (light/dark) -> color_var -> value
type ColorOverrides map[string]map[string]map[string]string

// ThemeCustomizationsResponse represents the API response
type ThemeCustomizationsResponse struct {
	ColorOverrides ColorOverrides `json:"colorOverrides"`
	UpdatedAt      string         `json:"updatedAt"`
}

// Routes registers the theme customization routes
func (h *ThemeCustomizationsHandler) Routes() chi.Router {
	r := chi.NewRouter()
	
	r.Get("/", h.GetCustomizations)
	r.Put("/", h.UpdateCustomizations)
	r.Delete("/", h.ResetCustomizations)
	
	return r
}

// checkPremium validates premium access
func (h *ThemeCustomizationsHandler) checkPremium(w http.ResponseWriter, r *http.Request) bool {
	if h.themeLicenseService == nil {
		// If no license service configured, allow access (for development)
		return true
	}
	
	hasPremium, err := h.themeLicenseService.HasPremiumAccess(r.Context())
	if err != nil || !hasPremium {
		http.Error(w, "Premium feature - valid license required", http.StatusForbidden)
		return false
	}
	
	return true
}

// GetCustomizations retrieves the user's theme customizations
func (h *ThemeCustomizationsHandler) GetCustomizations(w http.ResponseWriter, r *http.Request) {
	if !h.checkPremium(w, r) {
		return
	}
	
	var colorOverridesJSON sql.NullString
	var updatedAt string
	
	err := h.db.QueryRow(`
		SELECT color_overrides, updated_at 
		FROM theme_customizations 
		WHERE id = 1
	`).Scan(&colorOverridesJSON, &updatedAt)
	
	if err == sql.ErrNoRows {
		// No customizations yet, return empty
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(ThemeCustomizationsResponse{
			ColorOverrides: make(ColorOverrides),
		})
		return
	}
	
	if err != nil {
		log.Error().Err(err).Msg("Failed to get theme customizations")
		http.Error(w, "Failed to retrieve customizations", http.StatusInternalServerError)
		return
	}
	
	var overrides ColorOverrides
	if colorOverridesJSON.Valid && colorOverridesJSON.String != "" {
		if err := json.Unmarshal([]byte(colorOverridesJSON.String), &overrides); err != nil {
			log.Error().Err(err).Msg("Failed to parse color overrides")
			overrides = make(ColorOverrides)
		}
	} else {
		overrides = make(ColorOverrides)
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ThemeCustomizationsResponse{
		ColorOverrides: overrides,
		UpdatedAt:      updatedAt,
	})
}

// UpdateCustomizationsRequest represents the update request
type UpdateCustomizationsRequest struct {
	ColorOverrides ColorOverrides `json:"colorOverrides"`
}

// UpdateCustomizations updates the user's theme customizations
func (h *ThemeCustomizationsHandler) UpdateCustomizations(w http.ResponseWriter, r *http.Request) {
	if !h.checkPremium(w, r) {
		return
	}
	
	var req UpdateCustomizationsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	
	// Check if we have an empty overrides object - if so, delete the record
	if len(req.ColorOverrides) == 0 {
		// Delete the customizations entirely
		_, err := h.db.Exec(`DELETE FROM theme_customizations WHERE id = 1`)
		if err != nil {
			log.Error().Err(err).Msg("Failed to delete theme customizations")
			http.Error(w, "Failed to reset customizations", http.StatusInternalServerError)
			return
		}
		
		// Return empty response
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(ThemeCustomizationsResponse{
			ColorOverrides: make(ColorOverrides),
		})
		return
	}
	
	colorOverridesJSON, err := json.Marshal(req.ColorOverrides)
	if err != nil {
		log.Error().Err(err).Msg("Failed to marshal color overrides")
		http.Error(w, "Failed to process customizations", http.StatusInternalServerError)
		return
	}
	
	// Insert or update the customizations
	_, err = h.db.Exec(`
		INSERT INTO theme_customizations (id, color_overrides) 
		VALUES (1, ?)
		ON CONFLICT(id) DO UPDATE SET 
			color_overrides = excluded.color_overrides,
			updated_at = CURRENT_TIMESTAMP
	`, string(colorOverridesJSON))
	
	if err != nil {
		log.Error().Err(err).Msg("Failed to save theme customizations")
		http.Error(w, "Failed to save customizations", http.StatusInternalServerError)
		return
	}
	
	// Return the updated customizations
	h.GetCustomizations(w, r)
}

// ResetCustomizations removes all theme customizations
func (h *ThemeCustomizationsHandler) ResetCustomizations(w http.ResponseWriter, r *http.Request) {
	if !h.checkPremium(w, r) {
		return
	}
	
	_, err := h.db.Exec(`DELETE FROM theme_customizations WHERE id = 1`)
	
	if err != nil {
		log.Error().Err(err).Msg("Failed to reset theme customizations")
		http.Error(w, "Failed to reset customizations", http.StatusInternalServerError)
		return
	}
	
	w.WriteHeader(http.StatusNoContent)
}