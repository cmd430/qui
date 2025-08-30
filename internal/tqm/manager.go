package tqm

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"time"

	"github.com/dgraph-io/ristretto"
	"github.com/rs/zerolog/log"

	"github.com/autobrr/qui/internal/models"
	"github.com/autobrr/qui/internal/qbittorrent"
)

// Manager manages TQM operations across all instances
type Manager struct {
	db            *sql.DB
	instanceStore *models.InstanceStore
	clientPool    *qbittorrent.ClientPool
	cache         *ristretto.Cache
	clients       map[int64]*Client
	mu            sync.RWMutex
}

// NewManager creates a new TQM manager
func NewManager(db *sql.DB, instanceStore *models.InstanceStore, clientPool *qbittorrent.ClientPool) (*Manager, error) {
	// Create cache for TQM configurations and results
	cache, err := ristretto.NewCache(&ristretto.Config{
		NumCounters: 1e4,     // 10k
		MaxCost:     1 << 28, // 256MB
		BufferItems: 64,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create TQM cache: %w", err)
	}

	return &Manager{
		db:            db,
		instanceStore: instanceStore,
		clientPool:    clientPool,
		cache:         cache,
		clients:       make(map[int64]*Client),
	}, nil
}

// GetConfig retrieves TQM configuration for an instance
func (m *Manager) GetConfig(ctx context.Context, instanceID int64) (*ConfigResponse, error) {
	// Check cache first
	cacheKey := fmt.Sprintf("tqm:config:%d", instanceID)
	if cached, found := m.cache.Get(cacheKey); found {
		if config, ok := cached.(*ConfigResponse); ok {
			return config, nil
		}
	}

	// Get config from database
	config, err := m.getConfigFromDB(ctx, instanceID)
	if err != nil {
		return nil, err
	}

	// Get tag rules for the configuration
	tagRules, err := m.getTagRulesFromDB(ctx, config.ID)
	if err != nil {
		return nil, err
	}

	// Get last operation
	lastRun, err := m.getLastOperationFromDB(ctx, instanceID)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	response := &ConfigResponse{
		Config:   *config,
		TagRules: tagRules,
		LastRun:  lastRun,
	}

	// Cache the result for 5 minutes
	m.cache.SetWithTTL(cacheKey, response, 1, 5*time.Minute)

	return response, nil
}

// UpdateConfig updates TQM configuration for an instance
func (m *Manager) UpdateConfig(ctx context.Context, instanceID int64, req *ConfigRequest) (*ConfigResponse, error) {
	// Start transaction
	tx, err := m.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Get existing config
	config, err := m.getConfigFromDBTx(ctx, tx, instanceID)
	if err != nil {
		return nil, err
	}

	// Update config
	config.Name = req.Name
	config.Enabled = req.Enabled
	config.Filters = req.Filters
	config.UpdatedAt = time.Now()

	// Marshal filters to JSON
	if err := config.MarshalFilters(); err != nil {
		return nil, fmt.Errorf("failed to marshal filters: %w", err)
	}

	// Update in database
	query := `UPDATE tqm_configs SET name = ?, enabled = ?, filters_json = ?, updated_at = ? WHERE id = ?`
	if _, err := tx.ExecContext(ctx, query, config.Name, config.Enabled, config.FiltersJSON, config.UpdatedAt, config.ID); err != nil {
		return nil, fmt.Errorf("failed to update config: %w", err)
	}

	// Delete existing tag rules
	if _, err := tx.ExecContext(ctx, `DELETE FROM tqm_tag_rules WHERE config_id = ?`, config.ID); err != nil {
		return nil, fmt.Errorf("failed to delete existing tag rules: %w", err)
	}

	// Insert new tag rules
	var tagRules []TagRule
	for _, filter := range req.Filters {
		rule := TagRule{
			ConfigID:   config.ID,
			Name:       filter.Name,
			Mode:       filter.Mode,
			Expression: filter.Expression,
			UploadKB:   filter.UploadKB,
			Enabled:    filter.Enabled,
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
		}

		query := `INSERT INTO tqm_tag_rules (config_id, name, mode, expression, upload_kb, enabled, created_at, updated_at) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		result, err := tx.ExecContext(ctx, query, rule.ConfigID, rule.Name, rule.Mode, rule.Expression, rule.UploadKB, rule.Enabled, rule.CreatedAt, rule.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to insert tag rule: %w", err)
		}

		id, _ := result.LastInsertId()
		rule.ID = id
		tagRules = append(tagRules, rule)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Clear cache
	cacheKey := fmt.Sprintf("tqm:config:%d", instanceID)
	m.cache.Del(cacheKey)

	// Return updated configuration
	response := &ConfigResponse{
		Config:   *config,
		TagRules: tagRules,
	}

	return response, nil
}

// Retag performs retag operation on an instance
func (m *Manager) Retag(ctx context.Context, instanceID int64, configID int64) (*RetagResponse, error) {
	// Get TQM client for the instance
	tqmClient, err := m.getTQMClient(ctx, instanceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get TQM client: %w", err)
	}

	// Get configuration
	var config *Config
	if configID == 0 {
		// Use default configuration
		configResp, err := m.GetConfig(ctx, instanceID)
		if err != nil {
			return nil, fmt.Errorf("failed to get default config: %w", err)
		}
		config = &configResp.Config
	} else {
		// Get specific configuration
		config, err = m.getConfigFromDB(ctx, instanceID)
		if err != nil {
			return nil, err
		}
		if config.ID != configID {
			return nil, fmt.Errorf("configuration not found")
		}
	}

	if !config.Enabled {
		return nil, fmt.Errorf("TQM configuration is disabled")
	}

	// Create operation record
	operation := &Operation{
		InstanceID:        instanceID,
		OperationType:     "retag",
		Status:            "running",
		TorrentsProcessed: 0,
		TagsApplied:       0,
		StartedAt:         time.Now(),
	}

	operationID, err := m.createOperation(ctx, operation)
	if err != nil {
		return nil, fmt.Errorf("failed to create operation record: %w", err)
	}
	operation.ID = operationID

	// Perform retag operation
	result, err := tqmClient.Retag(ctx, config)
	if err != nil {
		// Update operation with error
		operation.Status = "failed"
		errMsg := err.Error()
		operation.ErrorMessage = &errMsg
		now := time.Now()
		operation.CompletedAt = &now

		if updateErr := m.updateOperation(ctx, operation); updateErr != nil {
			log.Error().Err(updateErr).Msg("Failed to update failed operation")
		}

		return nil, fmt.Errorf("retag operation failed: %w", err)
	}

	// Update operation with results
	operation.Status = "completed"
	operation.TorrentsProcessed = result.TorrentsProcessed
	operation.TagsApplied = result.TagsApplied
	operation.CompletedAt = &result.CompletedAt

	if err := m.updateOperation(ctx, operation); err != nil {
		log.Error().Err(err).Msg("Failed to update completed operation")
	}

	// Clear cache
	cacheKey := fmt.Sprintf("tqm:config:%d", instanceID)
	m.cache.Del(cacheKey)

	return &RetagResponse{
		OperationID:       operationID,
		Status:            operation.Status,
		TorrentsProcessed: operation.TorrentsProcessed,
		TagsApplied:       operation.TagsApplied,
		Message:           fmt.Sprintf("Successfully processed %d torrents and applied %d tags", operation.TorrentsProcessed, operation.TagsApplied),
	}, nil
}

// getTQMClient gets or creates a TQM client for an instance
func (m *Manager) getTQMClient(ctx context.Context, instanceID int64) (*Client, error) {
	m.mu.RLock()
	if client, exists := m.clients[instanceID]; exists {
		m.mu.RUnlock()
		return client, nil
	}
	m.mu.RUnlock()

	// Get qBittorrent client from pool
	qbtClient, err := m.clientPool.GetClient(ctx, int(instanceID))
	if err != nil {
		return nil, fmt.Errorf("failed to get qBittorrent client: %w", err)
	}

	// Get instance details
	instance, err := m.instanceStore.Get(ctx, int(instanceID))
	if err != nil {
		return nil, fmt.Errorf("failed to get instance: %w", err)
	}

	// Create TQM client
	tqmClient, err := NewClient(instanceID, instance, m.instanceStore, qbtClient.Client)
	if err != nil {
		return nil, fmt.Errorf("failed to create TQM client: %w", err)
	}

	// Store client
	m.mu.Lock()
	m.clients[instanceID] = tqmClient
	m.mu.Unlock()

	return tqmClient, nil
}

// Database helper methods
func (m *Manager) getConfigFromDB(ctx context.Context, instanceID int64) (*Config, error) {
	return m.getConfigFromDBTx(ctx, m.db, instanceID)
}

func (m *Manager) getConfigFromDBTx(ctx context.Context, tx interface{}, instanceID int64) (*Config, error) {
	query := `SELECT id, instance_id, name, enabled, filters_json, created_at, updated_at 
              FROM tqm_configs WHERE instance_id = ? LIMIT 1`

	var config Config
	var executor interface {
		QueryRowContext(context.Context, string, ...interface{}) *sql.Row
	}

	switch v := tx.(type) {
	case *sql.DB:
		executor = v
	case *sql.Tx:
		executor = v
	default:
		return nil, fmt.Errorf("invalid executor type")
	}

	err := executor.QueryRowContext(ctx, query, instanceID).Scan(
		&config.ID, &config.InstanceID, &config.Name, &config.Enabled,
		&config.FiltersJSON, &config.CreatedAt, &config.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	// Unmarshal filters
	if err := config.UnmarshalFilters(); err != nil {
		return nil, fmt.Errorf("failed to unmarshal filters: %w", err)
	}

	return &config, nil
}

func (m *Manager) getTagRulesFromDB(ctx context.Context, configID int64) ([]TagRule, error) {
	query := `SELECT id, config_id, name, mode, expression, upload_kb, enabled, created_at, updated_at 
              FROM tqm_tag_rules WHERE config_id = ? ORDER BY name`

	rows, err := m.db.QueryContext(ctx, query, configID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []TagRule
	for rows.Next() {
		var rule TagRule
		err := rows.Scan(&rule.ID, &rule.ConfigID, &rule.Name, &rule.Mode, &rule.Expression,
			&rule.UploadKB, &rule.Enabled, &rule.CreatedAt, &rule.UpdatedAt)
		if err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}

	return rules, rows.Err()
}

func (m *Manager) getLastOperationFromDB(ctx context.Context, instanceID int64) (*Operation, error) {
	query := `SELECT id, instance_id, operation_type, status, torrents_processed, tags_applied, 
              error_message, started_at, completed_at 
              FROM tqm_operations WHERE instance_id = ? ORDER BY started_at DESC LIMIT 1`

	var op Operation
	err := m.db.QueryRowContext(ctx, query, instanceID).Scan(
		&op.ID, &op.InstanceID, &op.OperationType, &op.Status,
		&op.TorrentsProcessed, &op.TagsApplied, &op.ErrorMessage,
		&op.StartedAt, &op.CompletedAt,
	)
	if err != nil {
		return nil, err
	}

	return &op, nil
}

func (m *Manager) createOperation(ctx context.Context, op *Operation) (int64, error) {
	query := `INSERT INTO tqm_operations (instance_id, operation_type, status, torrents_processed, tags_applied, started_at) 
              VALUES (?, ?, ?, ?, ?, ?)`

	result, err := m.db.ExecContext(ctx, query, op.InstanceID, op.OperationType, op.Status,
		op.TorrentsProcessed, op.TagsApplied, op.StartedAt)
	if err != nil {
		return 0, err
	}

	return result.LastInsertId()
}

func (m *Manager) updateOperation(ctx context.Context, op *Operation) error {
	query := `UPDATE tqm_operations SET status = ?, torrents_processed = ?, tags_applied = ?, 
              error_message = ?, completed_at = ? WHERE id = ?`

	_, err := m.db.ExecContext(ctx, query, op.Status, op.TorrentsProcessed, op.TagsApplied,
		op.ErrorMessage, op.CompletedAt, op.ID)
	return err
}

// GetFilterTemplates returns predefined filter templates
func (m *Manager) GetFilterTemplates(ctx context.Context) ([]FilterTemplate, error) {
	return FilterTemplates, nil
}

// ValidateExpression validates a TQM expression
func (m *Manager) ValidateExpression(ctx context.Context, expression string) (*ExpressionValidationResult, error) {
	// Use the autobrr/tqm library to compile and validate the expression
	tqmClient, err := m.getTQMClientForValidation(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get TQM client for validation: %w", err)
	}

	result, err := tqmClient.ValidateExpression(ctx, expression)
	if err != nil {
		return &ExpressionValidationResult{
			Valid: false,
			Error: err.Error(),
		}, nil
	}

	return result, nil
}

// TestExpression tests a TQM expression against sample torrents
func (m *Manager) TestExpression(ctx context.Context, instanceID int64, req *ExpressionTestRequest) (*ExpressionTestResponse, error) {
	// Get TQM client for the instance
	tqmClient, err := m.getTQMClient(ctx, instanceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get TQM client: %w", err)
	}

	// Set default limit if not specified
	limit := req.Limit
	if limit <= 0 {
		limit = 10 // Default to 10 torrents for testing
	}

	results, err := tqmClient.TestExpression(ctx, req.Expression, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to test expression: %w", err)
	}

	return results, nil
}

// CreateFilter creates a new individual filter
func (m *Manager) CreateFilter(ctx context.Context, instanceID int64, req *FilterRequest) (*TagRule, error) {
	// Validate expression first
	validationResult, err := m.ValidateExpression(ctx, req.Expression)
	if err != nil {
		return nil, fmt.Errorf("failed to validate expression: %w", err)
	}
	if !validationResult.Valid {
		return nil, fmt.Errorf("invalid expression: %s", validationResult.Error)
	}

	// Start transaction
	tx, err := m.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Get or create config for the instance
	config, err := m.getConfigFromDBTx(ctx, tx, instanceID)
	if err != nil {
		if err == sql.ErrNoRows {
			// Create default config
			config, err = m.createDefaultConfigTx(ctx, tx, instanceID)
			if err != nil {
				return nil, fmt.Errorf("failed to create default config: %w", err)
			}
		} else {
			return nil, fmt.Errorf("failed to get config: %w", err)
		}
	}

	// Create the new tag rule
	rule := TagRule{
		ConfigID:   config.ID,
		Name:       req.Name,
		Mode:       req.Mode,
		Expression: req.Expression,
		UploadKB:   req.UploadKB,
		Enabled:    req.Enabled,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	query := `INSERT INTO tqm_tag_rules (config_id, name, mode, expression, upload_kb, enabled, created_at, updated_at) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	result, err := tx.ExecContext(ctx, query, rule.ConfigID, rule.Name, rule.Mode, rule.Expression, rule.UploadKB, rule.Enabled, rule.CreatedAt, rule.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to insert tag rule: %w", err)
	}

	id, _ := result.LastInsertId()
	rule.ID = id

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Clear cache
	cacheKey := fmt.Sprintf("tqm:config:%d", instanceID)
	m.cache.Del(cacheKey)

	return &rule, nil
}

// UpdateFilter updates an existing filter
func (m *Manager) UpdateFilter(ctx context.Context, instanceID int64, filterID int64, req *FilterRequest) (*TagRule, error) {
	// Validate expression first
	validationResult, err := m.ValidateExpression(ctx, req.Expression)
	if err != nil {
		return nil, fmt.Errorf("failed to validate expression: %w", err)
	}
	if !validationResult.Valid {
		return nil, fmt.Errorf("invalid expression: %s", validationResult.Error)
	}

	// Start transaction
	tx, err := m.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Check if filter exists and belongs to the correct instance
	var configID int64
	checkQuery := `SELECT tr.config_id FROM tqm_tag_rules tr 
                   JOIN tqm_configs tc ON tr.config_id = tc.id 
                   WHERE tr.id = ? AND tc.instance_id = ?`
	err = tx.QueryRowContext(ctx, checkQuery, filterID, instanceID).Scan(&configID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("filter not found")
		}
		return nil, fmt.Errorf("failed to check filter ownership: %w", err)
	}

	// Update the filter
	updateQuery := `UPDATE tqm_tag_rules SET name = ?, mode = ?, expression = ?, upload_kb = ?, enabled = ?, updated_at = ? 
                    WHERE id = ?`
	updatedAt := time.Now()
	_, err = tx.ExecContext(ctx, updateQuery, req.Name, req.Mode, req.Expression, req.UploadKB, req.Enabled, updatedAt, filterID)
	if err != nil {
		return nil, fmt.Errorf("failed to update filter: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Clear cache
	cacheKey := fmt.Sprintf("tqm:config:%d", instanceID)
	m.cache.Del(cacheKey)

	// Return updated filter
	rule := &TagRule{
		ID:         filterID,
		ConfigID:   configID,
		Name:       req.Name,
		Mode:       req.Mode,
		Expression: req.Expression,
		UploadKB:   req.UploadKB,
		Enabled:    req.Enabled,
		UpdatedAt:  updatedAt,
	}

	return rule, nil
}

// DeleteFilter deletes an existing filter
func (m *Manager) DeleteFilter(ctx context.Context, instanceID int64, filterID int64) error {
	// Start transaction
	tx, err := m.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Check if filter exists and belongs to the correct instance
	checkQuery := `SELECT COUNT(1) FROM tqm_tag_rules tr 
                   JOIN tqm_configs tc ON tr.config_id = tc.id 
                   WHERE tr.id = ? AND tc.instance_id = ?`
	var count int
	err = tx.QueryRowContext(ctx, checkQuery, filterID, instanceID).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check filter ownership: %w", err)
	}
	if count == 0 {
		return fmt.Errorf("filter not found")
	}

	// Delete the filter
	deleteQuery := `DELETE FROM tqm_tag_rules WHERE id = ?`
	_, err = tx.ExecContext(ctx, deleteQuery, filterID)
	if err != nil {
		return fmt.Errorf("failed to delete filter: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Clear cache
	cacheKey := fmt.Sprintf("tqm:config:%d", instanceID)
	m.cache.Del(cacheKey)

	return nil
}

// getTQMClientForValidation gets a TQM client for expression validation (uses any available instance)
func (m *Manager) getTQMClientForValidation(ctx context.Context) (*Client, error) {
	// Try to get any existing client first
	m.mu.RLock()
	for _, client := range m.clients {
		m.mu.RUnlock()
		return client, nil
	}
	m.mu.RUnlock()

	// If no existing clients, try to create one with the first available instance
	instances, err := m.instanceStore.List(ctx, true) // activeOnly = true
	if err != nil {
		return nil, fmt.Errorf("failed to list instances: %w", err)
	}

	if len(instances) == 0 {
		return nil, fmt.Errorf("no instances available for validation")
	}

	// Use the first available instance for validation
	return m.getTQMClient(ctx, int64(instances[0].ID))
}

// createDefaultConfigTx creates a default TQM configuration for an instance within a transaction
func (m *Manager) createDefaultConfigTx(ctx context.Context, tx *sql.Tx, instanceID int64) (*Config, error) {
	config := Config{
		InstanceID: instanceID,
		Name:       "Default Configuration",
		Enabled:    true,
		Filters:    DefaultFilters,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	// Marshal filters to JSON
	if err := config.MarshalFilters(); err != nil {
		return nil, fmt.Errorf("failed to marshal filters: %w", err)
	}

	// Insert config
	query := `INSERT INTO tqm_configs (instance_id, name, enabled, filters_json, created_at, updated_at) 
              VALUES (?, ?, ?, ?, ?, ?)`
	result, err := tx.ExecContext(ctx, query, config.InstanceID, config.Name, config.Enabled, config.FiltersJSON, config.CreatedAt, config.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to insert config: %w", err)
	}

	id, _ := result.LastInsertId()
	config.ID = id

	// Insert default tag rules
	for _, filter := range DefaultFilters {
		rule := TagRule{
			ConfigID:   config.ID,
			Name:       filter.Name,
			Mode:       filter.Mode,
			Expression: filter.Expression,
			Enabled:    filter.Enabled,
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
		}

		ruleQuery := `INSERT INTO tqm_tag_rules (config_id, name, mode, expression, enabled, created_at, updated_at) 
                      VALUES (?, ?, ?, ?, ?, ?, ?)`
		_, err := tx.ExecContext(ctx, ruleQuery, rule.ConfigID, rule.Name, rule.Mode, rule.Expression, rule.Enabled, rule.CreatedAt, rule.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to insert tag rule: %w", err)
		}
	}

	return &config, nil
}

// Close closes the TQM manager and all clients
func (m *Manager) Close() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, client := range m.clients {
		if err := client.Close(); err != nil {
			log.Error().Err(err).Msg("Failed to close TQM client")
		}
	}

	m.clients = make(map[int64]*Client)
	m.cache.Clear()
	return nil
}
