// Copyright (c) 2025, s0up and the autobrr contributors.
// SPDX-License-Identifier: GPL-2.0-or-later

package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"

	"github.com/autobrr/qui/internal/tqm"
)

type TQMHandler struct {
	tqmManager *tqm.Manager
}

func NewTQMHandler(tqmManager *tqm.Manager) *TQMHandler {
	return &TQMHandler{
		tqmManager: tqmManager,
	}
}

// GetTQMConfig returns TQM configuration for an instance
// GET /api/instances/{instanceID}/tqm/config
func (h *TQMHandler) GetTQMConfig(w http.ResponseWriter, r *http.Request) {
	instanceID, err := strconv.ParseInt(chi.URLParam(r, "instanceID"), 10, 64)
	if err != nil {
		log.Error().Err(err).Msg("Invalid instance ID")
		http.Error(w, "Invalid instance ID", http.StatusBadRequest)
		return
	}

	config, err := h.tqmManager.GetConfig(r.Context(), instanceID)
	if err != nil {
		log.Error().Err(err).Int64("instanceID", instanceID).Msg("Failed to get TQM config")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(config); err != nil {
		log.Error().Err(err).Msg("Failed to encode TQM config response")
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

// UpdateTQMConfig updates TQM configuration for an instance
// PUT /api/instances/{instanceID}/tqm/config
func (h *TQMHandler) UpdateTQMConfig(w http.ResponseWriter, r *http.Request) {
	instanceID, err := strconv.ParseInt(chi.URLParam(r, "instanceID"), 10, 64)
	if err != nil {
		log.Error().Err(err).Msg("Invalid instance ID")
		http.Error(w, "Invalid instance ID", http.StatusBadRequest)
		return
	}

	var req tqm.ConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Error().Err(err).Msg("Failed to decode TQM config request")
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.Name == "" {
		http.Error(w, "Configuration name is required", http.StatusBadRequest)
		return
	}

	// Validate tag rules
	for i, filter := range req.Filters {
		if filter.Name == "" {
			log.Error().Int("filterIndex", i).Msg("Filter name is required")
			http.Error(w, "Filter name is required", http.StatusBadRequest)
			return
		}
		if filter.Mode == "" {
			log.Error().Int("filterIndex", i).Str("filterName", filter.Name).Msg("Filter mode is required")
			http.Error(w, "Filter mode is required", http.StatusBadRequest)
			return
		}
		if filter.Mode != "add" && filter.Mode != "remove" && filter.Mode != "full" {
			log.Error().Int("filterIndex", i).Str("filterName", filter.Name).Str("mode", filter.Mode).Msg("Invalid filter mode")
			http.Error(w, "Filter mode must be 'add', 'remove', or 'full'", http.StatusBadRequest)
			return
		}
		if filter.Expression == "" {
			log.Error().Int("filterIndex", i).Str("filterName", filter.Name).Msg("Filter expression is required")
			http.Error(w, "Filter expression is required", http.StatusBadRequest)
			return
		}
	}

	config, err := h.tqmManager.UpdateConfig(r.Context(), instanceID, &req)
	if err != nil {
		log.Error().Err(err).Int64("instanceID", instanceID).Msg("Failed to update TQM config")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(config); err != nil {
		log.Error().Err(err).Msg("Failed to encode TQM config response")
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

// PostRetag triggers a retag operation on an instance
// POST /api/instances/{instanceID}/tqm/retag
func (h *TQMHandler) PostRetag(w http.ResponseWriter, r *http.Request) {
	instanceID, err := strconv.ParseInt(chi.URLParam(r, "instanceID"), 10, 64)
	if err != nil {
		log.Error().Err(err).Msg("Invalid instance ID")
		http.Error(w, "Invalid instance ID", http.StatusBadRequest)
		return
	}

	var req tqm.RetagRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// If body is empty or invalid, use default values
		req.InstanceID = instanceID
		req.ConfigID = 0 // Use default config
	} else {
		// Validate that instance ID matches
		if req.InstanceID != instanceID && req.InstanceID != 0 {
			log.Error().Int64("urlInstanceID", instanceID).Int64("bodyInstanceID", req.InstanceID).Msg("Instance ID mismatch")
			http.Error(w, "Instance ID mismatch", http.StatusBadRequest)
			return
		}
		req.InstanceID = instanceID
	}

	log.Info().Int64("instanceID", instanceID).Int64("configID", req.ConfigID).Msg("Starting TQM retag operation")

	response, err := h.tqmManager.Retag(r.Context(), instanceID, req.ConfigID)
	if err != nil {
		log.Error().Err(err).Int64("instanceID", instanceID).Msg("Failed to retag torrents")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted) // 202 for async operation
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Error().Err(err).Msg("Failed to encode retag response")
		// Don't return error here since operation may have succeeded
		return
	}

	log.Info().
		Int64("instanceID", instanceID).
		Int64("operationID", response.OperationID).
		Int("torrentsProcessed", response.TorrentsProcessed).
		Int("tagsApplied", response.TagsApplied).
		Msg("TQM retag operation completed")
}

// GetTQMStatus returns the status of the last TQM operation
// GET /api/instances/{instanceID}/tqm/status
func (h *TQMHandler) GetTQMStatus(w http.ResponseWriter, r *http.Request) {
	instanceID, err := strconv.ParseInt(chi.URLParam(r, "instanceID"), 10, 64)
	if err != nil {
		log.Error().Err(err).Msg("Invalid instance ID")
		http.Error(w, "Invalid instance ID", http.StatusBadRequest)
		return
	}

	config, err := h.tqmManager.GetConfig(r.Context(), instanceID)
	if err != nil {
		log.Error().Err(err).Int64("instanceID", instanceID).Msg("Failed to get TQM config for status")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Return just the last run information
	response := map[string]interface{}{
		"instanceId": instanceID,
		"lastRun":    config.LastRun,
		"enabled":    config.Config.Enabled,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Error().Err(err).Msg("Failed to encode TQM status response")
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

// GetFilterTemplates returns predefined filter templates
// GET /api/instances/{instanceID}/tqm/templates
func (h *TQMHandler) GetFilterTemplates(w http.ResponseWriter, r *http.Request) {
	instanceID, err := strconv.ParseInt(chi.URLParam(r, "instanceID"), 10, 64)
	if err != nil {
		log.Error().Err(err).Msg("Invalid instance ID")
		http.Error(w, "Invalid instance ID", http.StatusBadRequest)
		return
	}

	templates, err := h.tqmManager.GetFilterTemplates(r.Context())
	if err != nil {
		log.Error().Err(err).Int64("instanceID", instanceID).Msg("Failed to get filter templates")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(templates); err != nil {
		log.Error().Err(err).Msg("Failed to encode templates response")
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

// ValidateExpression validates a TQM expression
// POST /api/instances/{instanceID}/tqm/validate
func (h *TQMHandler) ValidateExpression(w http.ResponseWriter, r *http.Request) {
	instanceID, err := strconv.ParseInt(chi.URLParam(r, "instanceID"), 10, 64)
	if err != nil {
		log.Error().Err(err).Msg("Invalid instance ID")
		http.Error(w, "Invalid instance ID", http.StatusBadRequest)
		return
	}

	var req tqm.ExpressionValidationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Error().Err(err).Msg("Failed to decode expression validation request")
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Expression == "" {
		http.Error(w, "Expression is required", http.StatusBadRequest)
		return
	}

	result, err := h.tqmManager.ValidateExpression(r.Context(), req.Expression)
	if err != nil {
		log.Error().Err(err).Int64("instanceID", instanceID).Str("expression", req.Expression).Msg("Failed to validate expression")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(result); err != nil {
		log.Error().Err(err).Msg("Failed to encode validation response")
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

// TestExpression tests a TQM expression against sample torrents
// POST /api/instances/{instanceID}/tqm/test
func (h *TQMHandler) TestExpression(w http.ResponseWriter, r *http.Request) {
	instanceID, err := strconv.ParseInt(chi.URLParam(r, "instanceID"), 10, 64)
	if err != nil {
		log.Error().Err(err).Msg("Invalid instance ID")
		http.Error(w, "Invalid instance ID", http.StatusBadRequest)
		return
	}

	var req tqm.ExpressionTestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Error().Err(err).Msg("Failed to decode expression test request")
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Expression == "" {
		http.Error(w, "Expression is required", http.StatusBadRequest)
		return
	}

	results, err := h.tqmManager.TestExpression(r.Context(), instanceID, &req)
	if err != nil {
		log.Error().Err(err).Int64("instanceID", instanceID).Str("expression", req.Expression).Msg("Failed to test expression")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(results); err != nil {
		log.Error().Err(err).Msg("Failed to encode test results")
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

// CreateFilter creates a new individual filter
// POST /api/instances/{instanceID}/tqm/filters
func (h *TQMHandler) CreateFilter(w http.ResponseWriter, r *http.Request) {
	instanceID, err := strconv.ParseInt(chi.URLParam(r, "instanceID"), 10, 64)
	if err != nil {
		log.Error().Err(err).Msg("Invalid instance ID")
		http.Error(w, "Invalid instance ID", http.StatusBadRequest)
		return
	}

	var req tqm.FilterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Error().Err(err).Msg("Failed to decode filter request")
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.Name == "" {
		http.Error(w, "Filter name is required", http.StatusBadRequest)
		return
	}
	if req.Expression == "" {
		http.Error(w, "Filter expression is required", http.StatusBadRequest)
		return
	}
	if req.Mode == "" {
		http.Error(w, "Filter mode is required", http.StatusBadRequest)
		return
	}
	if req.Mode != "add" && req.Mode != "remove" && req.Mode != "full" {
		http.Error(w, "Filter mode must be 'add', 'remove', or 'full'", http.StatusBadRequest)
		return
	}

	filter, err := h.tqmManager.CreateFilter(r.Context(), instanceID, &req)
	if err != nil {
		log.Error().Err(err).Int64("instanceID", instanceID).Msg("Failed to create filter")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(filter); err != nil {
		log.Error().Err(err).Msg("Failed to encode filter response")
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

// UpdateFilter updates an existing filter
// PUT /api/instances/{instanceID}/tqm/filters/{filterID}
func (h *TQMHandler) UpdateFilter(w http.ResponseWriter, r *http.Request) {
	instanceID, err := strconv.ParseInt(chi.URLParam(r, "instanceID"), 10, 64)
	if err != nil {
		log.Error().Err(err).Msg("Invalid instance ID")
		http.Error(w, "Invalid instance ID", http.StatusBadRequest)
		return
	}

	filterID, err := strconv.ParseInt(chi.URLParam(r, "filterID"), 10, 64)
	if err != nil {
		log.Error().Err(err).Msg("Invalid filter ID")
		http.Error(w, "Invalid filter ID", http.StatusBadRequest)
		return
	}

	var req tqm.FilterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Error().Err(err).Msg("Failed to decode filter request")
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.Name == "" {
		http.Error(w, "Filter name is required", http.StatusBadRequest)
		return
	}
	if req.Expression == "" {
		http.Error(w, "Filter expression is required", http.StatusBadRequest)
		return
	}
	if req.Mode == "" {
		http.Error(w, "Filter mode is required", http.StatusBadRequest)
		return
	}
	if req.Mode != "add" && req.Mode != "remove" && req.Mode != "full" {
		http.Error(w, "Filter mode must be 'add', 'remove', or 'full'", http.StatusBadRequest)
		return
	}

	filter, err := h.tqmManager.UpdateFilter(r.Context(), instanceID, filterID, &req)
	if err != nil {
		log.Error().Err(err).Int64("instanceID", instanceID).Int64("filterID", filterID).Msg("Failed to update filter")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(filter); err != nil {
		log.Error().Err(err).Msg("Failed to encode filter response")
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

// DeleteFilter deletes an existing filter
// DELETE /api/instances/{instanceID}/tqm/filters/{filterID}
func (h *TQMHandler) DeleteFilter(w http.ResponseWriter, r *http.Request) {
	instanceID, err := strconv.ParseInt(chi.URLParam(r, "instanceID"), 10, 64)
	if err != nil {
		log.Error().Err(err).Msg("Invalid instance ID")
		http.Error(w, "Invalid instance ID", http.StatusBadRequest)
		return
	}

	filterID, err := strconv.ParseInt(chi.URLParam(r, "filterID"), 10, 64)
	if err != nil {
		log.Error().Err(err).Msg("Invalid filter ID")
		http.Error(w, "Invalid filter ID", http.StatusBadRequest)
		return
	}

	err = h.tqmManager.DeleteFilter(r.Context(), instanceID, filterID)
	if err != nil {
		log.Error().Err(err).Int64("instanceID", instanceID).Int64("filterID", filterID).Msg("Failed to delete filter")
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
