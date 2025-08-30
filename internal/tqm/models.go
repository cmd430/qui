package tqm

import (
	"encoding/json"
	"strings"
	"time"
)

// Config represents a TQM configuration for an instance
type Config struct {
	ID          int64     `json:"id" db:"id"`
	InstanceID  int64     `json:"instanceId" db:"instance_id"`
	Name        string    `json:"name" db:"name"`
	Enabled     bool      `json:"enabled" db:"enabled"`
	FiltersJSON string    `json:"-" db:"filters_json"`
	Filters     []TagRule `json:"filters"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
}

// TagRule represents a tag rule configuration
type TagRule struct {
	ID         int64     `json:"id" db:"id"`
	ConfigID   int64     `json:"configId" db:"config_id"`
	Name       string    `json:"name" db:"name"`
	Mode       string    `json:"mode" db:"mode"` // "add", "remove", "full"
	Expression string    `json:"expression" db:"expression"`
	UploadKB   *int      `json:"uploadKb,omitempty" db:"upload_kb"`
	Enabled    bool      `json:"enabled" db:"enabled"`
	CreatedAt  time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt  time.Time `json:"updatedAt" db:"updated_at"`
}

// Operation represents a TQM operation (retag, remove, etc.)
type Operation struct {
	ID                int64      `json:"id" db:"id"`
	InstanceID        int64      `json:"instanceId" db:"instance_id"`
	OperationType     string     `json:"operationType" db:"operation_type"`
	Status            string     `json:"status" db:"status"` // "running", "completed", "failed"
	TorrentsProcessed int        `json:"torrentsProcessed" db:"torrents_processed"`
	TagsApplied       int        `json:"tagsApplied" db:"tags_applied"`
	ErrorMessage      *string    `json:"errorMessage,omitempty" db:"error_message"`
	StartedAt         time.Time  `json:"startedAt" db:"started_at"`
	CompletedAt       *time.Time `json:"completedAt,omitempty" db:"completed_at"`
}

// RetagRequest represents a request to retag torrents
type RetagRequest struct {
	InstanceID int64 `json:"instanceId"`
	ConfigID   int64 `json:"configId,omitempty"` // Optional, uses default if not specified
}

// RetagResponse represents the response from a retag operation
type RetagResponse struct {
	OperationID       int64  `json:"operationId"`
	Status            string `json:"status"`
	TorrentsProcessed int    `json:"torrentsProcessed"`
	TagsApplied       int    `json:"tagsApplied"`
	Message           string `json:"message"`
}

// ConfigRequest represents a request to update TQM configuration
type ConfigRequest struct {
	Name    string    `json:"name"`
	Enabled bool      `json:"enabled"`
	Filters []TagRule `json:"filters"`
}

// ConfigResponse represents the full TQM configuration response
type ConfigResponse struct {
	Config   Config     `json:"config"`
	TagRules []TagRule  `json:"tagRules"`
	LastRun  *Operation `json:"lastRun,omitempty"`
}

// TorrentTag represents a tag applied by TQM to a torrent
type TorrentTag struct {
	Name      string `json:"name"`
	AppliedBy string `json:"appliedBy"` // "tqm" for TQM-applied tags
}

// Filter result info from TQM evaluation
type FilterResult struct {
	TorrentHash  string   `json:"torrentHash"`
	TorrentName  string   `json:"torrentName"`
	TagsToAdd    []string `json:"tagsToAdd"`
	TagsToRemove []string `json:"tagsToRemove"`
	UploadLimit  *int     `json:"uploadLimit,omitempty"`
	Reason       string   `json:"reason"` // Description of why tags were applied
}

// UnmarshalFilters converts the JSON filters string to TagRule slice
func (c *Config) UnmarshalFilters() error {
	if c.FiltersJSON == "" {
		c.Filters = []TagRule{}
		return nil
	}

	if err := json.Unmarshal([]byte(c.FiltersJSON), &c.Filters); err != nil {
		return err
	}

	// Defensive: Default enabled to true if not specified (backward compatibility)
	for i := range c.Filters {
		if c.FiltersJSON != "" && !strings.Contains(c.FiltersJSON, `"enabled"`) {
			// If the JSON doesn't contain any "enabled" field, default all to true
			c.Filters[i].Enabled = true
		}
	}

	return nil
}

// MarshalFilters converts the TagRule slice to JSON string
func (c *Config) MarshalFilters() error {
	data, err := json.Marshal(c.Filters)
	if err != nil {
		return err
	}
	c.FiltersJSON = string(data)
	return nil
}

// Default filter configurations
var DefaultFilters = []TagRule{
	{
		Name:       "unregistered",
		Mode:       "full",
		Expression: "IsUnregistered()",
		Enabled:    true,
	},
	{
		Name:       "tracker-down",
		Mode:       "full",
		Expression: "IsTrackerDown()",
		Enabled:    true,
	},
}

// Common TQM expressions
var CommonExpressions = map[string]string{
	"IsUnregistered": "IsUnregistered()",
	"IsTrackerDown":  "IsTrackerDown()",
	"LowSeeds":       "Seeds <= 3",
	"HighRatio":      "Ratio >= 2.0",
	"OldTorrent":     "SeedingDays >= 30",
	"SmallTorrent":   "Size <= 100*1024*1024",     // 100MB
	"LargeTorrent":   "Size >= 10*1024*1024*1024", // 10GB
}
