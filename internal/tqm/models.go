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

// FilterTemplate represents a predefined filter template
type FilterTemplate struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Expression  string `json:"expression"`
	Category    string `json:"category"`
	Mode        string `json:"mode"`
	UploadKB    *int   `json:"uploadKb,omitempty"`
}

// FilterRequest represents a request to create or update a filter
type FilterRequest struct {
	Name       string `json:"name"`
	Mode       string `json:"mode"` // "add", "remove", "full"
	Expression string `json:"expression"`
	UploadKB   *int   `json:"uploadKb,omitempty"`
	Enabled    bool   `json:"enabled"`
}

// ExpressionValidationRequest represents a request to validate an expression
type ExpressionValidationRequest struct {
	Expression string `json:"expression"`
}

// ExpressionValidationResult represents the result of expression validation
type ExpressionValidationResult struct {
	Valid  bool     `json:"valid"`
	Error  string   `json:"error,omitempty"`
	Fields []string `json:"fields,omitempty"` // Fields referenced in the expression
}

// ExpressionTestRequest represents a request to test an expression
type ExpressionTestRequest struct {
	Expression string `json:"expression"`
	Limit      int    `json:"limit,omitempty"` // Max torrents to test against
}

// ExpressionTestResult represents the result of testing an expression
type ExpressionTestResult struct {
	TorrentHash string `json:"torrentHash"`
	TorrentName string `json:"torrentName"`
	Matched     bool   `json:"matched"`
	Error       string `json:"error,omitempty"`
	EvaluatedTo any    `json:"evaluatedTo,omitempty"` // The actual result of the expression
}

// ExpressionTestResponse represents the full response from testing an expression
type ExpressionTestResponse struct {
	Results      []ExpressionTestResult `json:"results"`
	TotalTested  int                    `json:"totalTested"`
	MatchedCount int                    `json:"matchedCount"`
	ErrorCount   int                    `json:"errorCount"`
}

// Predefined filter templates
var FilterTemplates = []FilterTemplate{
	{
		ID:          "unregistered",
		Name:        "Unregistered Torrents",
		Description: "Mark torrents that are no longer registered with their tracker",
		Expression:  "IsUnregistered()",
		Category:    "tracker",
		Mode:        "full",
	},
	{
		ID:          "tracker-down",
		Name:        "Tracker Down",
		Description: "Mark torrents with unreachable trackers",
		Expression:  "IsTrackerDown()",
		Category:    "tracker",
		Mode:        "full",
	},
	{
		ID:          "low-seeds",
		Name:        "Low Seed Count",
		Description: "Tag torrents with 3 or fewer seeds",
		Expression:  "Seeds <= 3 && !IsUnregistered()",
		Category:    "seeding",
		Mode:        "full",
	},
	{
		ID:          "high-ratio",
		Name:        "High Ratio Seeding",
		Description: "Tag torrents with ratio above 2.0 that have been seeding for at least a week",
		Expression:  "Ratio >= 2.0 && SeedingDays >= 7",
		Category:    "ratio",
		Mode:        "full",
	},
	{
		ID:          "old-torrents",
		Name:        "Old Torrents",
		Description: "Tag torrents that have been seeding for over 30 days",
		Expression:  "SeedingDays >= 30",
		Category:    "age",
		Mode:        "full",
	},
	{
		ID:          "small-torrents",
		Name:        "Small Torrents",
		Description: "Tag torrents smaller than 100MB",
		Expression:  "Size <= 100*1024*1024",
		Category:    "size",
		Mode:        "full",
	},
	{
		ID:          "large-torrents",
		Name:        "Large Torrents",
		Description: "Tag torrents larger than 10GB",
		Expression:  "Size >= 10*1024*1024*1024",
		Category:    "size",
		Mode:        "full",
	},
	{
		ID:          "slow-upload",
		Name:        "Limit Upload Speed",
		Description: "Apply upload speed limit to torrents with high ratio",
		Expression:  "Ratio >= 3.0",
		Category:    "bandwidth",
		Mode:        "full",
		UploadKB:    intPtr(100), // 100 KB/s limit
	},
	{
		ID:          "stalled-downloading",
		Name:        "Stalled Downloads",
		Description: "Tag downloading torrents that are stalled",
		Expression:  `State == "stalledDL"`,
		Category:    "state",
		Mode:        "full",
	},
	{
		ID:          "completed-today",
		Name:        "Recently Completed",
		Description: "Tag torrents completed in the last 24 hours",
		Expression:  "CompletedDays < 1",
		Category:    "recent",
		Mode:        "add",
	},
}

// Helper function to create int pointer
func intPtr(i int) *int {
	return &i
}
