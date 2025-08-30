package tqm

import (
	"context"
	"fmt"
	"time"

	qbt "github.com/autobrr/go-qbittorrent"
	tqmClient "github.com/autobrr/tqm/pkg/client"
	tqmConfig "github.com/autobrr/tqm/pkg/config"
	tqmExpression "github.com/autobrr/tqm/pkg/expression"
	"github.com/expr-lang/expr"
	"github.com/rs/zerolog/log"

	"github.com/autobrr/qui/internal/models"
)

// Client wraps TQM client with qui-specific functionality
type Client struct {
	instanceID    int64
	instance      *models.Instance
	instanceStore *models.InstanceStore
	qbtClient     *qbt.Client
	tqmClient     tqmClient.TagInterface
	lastConnected time.Time
	isConnected   bool
}

// NewClient creates a new TQM client for the given instance
func NewClient(instanceID int64, instance *models.Instance, instanceStore *models.InstanceStore, qbtClient *qbt.Client) (*Client, error) {
	c := &Client{
		instanceID:    instanceID,
		instance:      instance,
		instanceStore: instanceStore,
		qbtClient:     qbtClient,
	}

	// Initialize TQM client
	if err := c.initTQMClient(); err != nil {
		return nil, fmt.Errorf("failed to initialize TQM client: %w", err)
	}

	return c, nil
}

// initTQMClient initializes the TQM client with default filters
func (c *Client) initTQMClient() error {
	// Configure TQM global config with instance details
	if err := c.configureTQMGlobalConfig(); err != nil {
		return fmt.Errorf("failed to configure TQM global config: %w", err)
	}

	// Initialize TQM tracker status patterns - CRITICAL for IsUnregistered() to work
	tqmConfig.InitializeTrackerStatuses(nil)

	log.Debug().
		Int64("instanceId", c.instanceID).
		Msg("Initialized TQM tracker status patterns")

	// Create default filter configuration
	filterConfig := &tqmConfig.FilterConfiguration{
		Tag: []struct {
			Name     string
			Mode     string
			UploadKb *int `mapstructure:"uploadKb"`
			Update   []string
		}{
			{
				Name:   "unregistered",
				Mode:   "full",
				Update: []string{"IsUnregistered()"},
			},
			{
				Name:   "tracker-down",
				Mode:   "full",
				Update: []string{"IsTrackerDown()"},
			},
		},
	}

	// Compile filter expression
	exp, err := tqmExpression.Compile(filterConfig)
	if err != nil {
		return fmt.Errorf("failed to compile filter config: %w", err)
	}

	// Create TQM client
	client, err := tqmClient.NewClient("qbittorrent", c.instance.Name, exp)
	if err != nil {
		return fmt.Errorf("failed to create TQM client: %w", err)
	}

	// Cast to TagInterface for tagging operations
	tagClient, ok := client.(tqmClient.TagInterface)
	if !ok {
		return fmt.Errorf("qBittorrent client does not implement TagInterface")
	}

	c.tqmClient = tagClient
	return nil
}

// configureTQMGlobalConfig sets up the TQM global config with instance connection details
func (c *Client) configureTQMGlobalConfig() error {
	// Decrypt password using instance store
	password, err := c.instanceStore.GetDecryptedPassword(c.instance)
	if err != nil {
		return fmt.Errorf("failed to decrypt password: %w", err)
	}

	// Use the full host URL (it's already formatted properly in qui)
	qbitURL := c.instance.Host

	// Set the client configuration in the global TQM config
	clientConfigKey := fmt.Sprintf("clients%s%s", tqmConfig.Delimiter, c.instance.Name)

	// Set required connection details
	_ = tqmConfig.K.Set(clientConfigKey+".Url", qbitURL)
	_ = tqmConfig.K.Set(clientConfigKey+".User", c.instance.Username)
	_ = tqmConfig.K.Set(clientConfigKey+".Password", password)
	_ = tqmConfig.K.Set(clientConfigKey+".EnableAutoTmmAfterRelabel", false)
	_ = tqmConfig.K.Set(clientConfigKey+".CreateTagsUpfront", true)

	log.Debug().
		Int64("instanceId", c.instanceID).
		Str("instanceName", c.instance.Name).
		Str("url", qbitURL).
		Msg("Configured TQM global config for instance")

	return nil
}

// Connect establishes connection to qBittorrent through TQM
func (c *Client) Connect(ctx context.Context) error {
	if c.tqmClient == nil {
		return fmt.Errorf("TQM client not initialized")
	}

	// Use existing qBittorrent client connection details
	err := c.tqmClient.Connect(ctx)
	if err != nil {
		return fmt.Errorf("failed to connect TQM client: %w", err)
	}

	c.isConnected = true
	c.lastConnected = time.Now()

	// Create tags upfront to ensure they exist before tagging operations
	if err := c.createTagsUpfront(ctx); err != nil {
		log.Warn().
			Err(err).
			Int64("instanceId", c.instanceID).
			Msg("Failed to create tags upfront, continuing anyway")
	}

	log.Debug().
		Int64("instanceId", c.instanceID).
		Str("instanceName", c.instance.Name).
		Msg("TQM client connected successfully")

	return nil
}

// IsConnected returns whether the TQM client is connected
func (c *Client) IsConnected() bool {
	return c.isConnected && c.tqmClient != nil
}

// Retag performs retag operation on torrents using the configured filters
func (c *Client) Retag(ctx context.Context, config *Config) (*RetagResult, error) {
	if !c.IsConnected() {
		if err := c.Connect(ctx); err != nil {
			return nil, fmt.Errorf("failed to connect before retag: %w", err)
		}
	}

	log.Info().
		Int64("instanceId", c.instanceID).
		Str("configName", config.Name).
		Msg("Starting TQM retag operation")

	startTime := time.Now()
	result := &RetagResult{
		StartedAt:         startTime,
		TorrentsProcessed: 0,
		TagsApplied:       0,
		TagsRemoved:       0,
		Results:           []FilterResult{},
	}

	// Update TQM client with new filter configuration
	if err := c.updateFilters(config); err != nil {
		return nil, fmt.Errorf("failed to update filters: %w", err)
	}

	// Get torrents from qBittorrent through TQM
	torrents, err := c.tqmClient.GetTorrents(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get torrents: %w", err)
	}

	result.TorrentsProcessed = len(torrents)

	// Process each torrent through TQM filters
	processedCount := 0
	for _, torrent := range torrents {
		processedCount++
		retagInfo, err := c.tqmClient.ShouldRetag(ctx, &torrent)
		if err != nil {
			log.Warn().
				Err(err).
				Str("torrentHash", torrent.Hash).
				Msg("Failed to check retag for torrent")
			continue
		}

		// Log every 50th torrent or if it has changes, or first few with detailed data
		shouldLog := processedCount%50 == 1 || processedCount <= 5 || len(retagInfo.Add) > 0 || len(retagInfo.Remove) > 0
		shouldLogDetailed := processedCount <= 2 // First two torrents with detailed data

		if shouldLog {
			debugEvent := log.Debug().
				Int("torrentIndex", processedCount).
				Str("torrentHash", torrent.Hash[:8]).
				Str("torrentName", func() string {
					if len(torrent.Name) > 30 {
						return torrent.Name[:30] + "..."
					}
					return torrent.Name
				}()).
				Int("tagsToAdd", len(retagInfo.Add)).
				Int("tagsToRemove", len(retagInfo.Remove))

			if shouldLogDetailed {
				// Check if torrent is unregistered for debugging
				isUnregistered := torrent.IsUnregistered(ctx)

				debugEvent = debugEvent.
					Str("torrentState", torrent.State).
					Strs("torrentTags", torrent.Tags).
					Str("trackerName", torrent.TrackerName).
					Str("trackerStatus", torrent.TrackerStatus).
					Bool("isPrivate", torrent.IsPrivate).
					Bool("isUnregistered", isUnregistered).
					Interface("allTrackerStatuses", torrent.AllTrackerStatuses)
			}

			debugEvent.Msg("TQM evaluation for torrent")
		}

		// Convert map sets to slices for easier handling
		tagsToAdd := make([]string, 0, len(retagInfo.Add))
		for tag := range retagInfo.Add {
			tagsToAdd = append(tagsToAdd, tag)
		}

		tagsToRemove := make([]string, 0, len(retagInfo.Remove))
		for tag := range retagInfo.Remove {
			tagsToRemove = append(tagsToRemove, tag)
		}

		if len(tagsToAdd) > 0 || len(tagsToRemove) > 0 {
			log.Debug().
				Str("torrentHash", torrent.Hash).
				Str("torrentName", torrent.Name).
				Strs("tagsToAdd", tagsToAdd).
				Strs("tagsToRemove", tagsToRemove).
				Msg("Applying TQM tag changes to torrent")

			// Apply tags to add
			if len(tagsToAdd) > 0 {
				if err := c.tqmClient.AddTags(ctx, torrent.Hash, tagsToAdd); err != nil {
					log.Warn().
						Err(err).
						Str("torrentHash", torrent.Hash).
						Strs("tagsToAdd", tagsToAdd).
						Msg("Failed to add tags")
					continue
				}
				log.Debug().
					Str("torrentHash", torrent.Hash).
					Strs("tagsAdded", tagsToAdd).
					Msg("Successfully added tags to torrent")
			}

			// Remove tags
			if len(tagsToRemove) > 0 {
				if err := c.tqmClient.RemoveTags(ctx, torrent.Hash, tagsToRemove); err != nil {
					log.Warn().
						Err(err).
						Str("torrentHash", torrent.Hash).
						Strs("tagsToRemove", tagsToRemove).
						Msg("Failed to remove tags")
					continue
				}
				log.Debug().
					Str("torrentHash", torrent.Hash).
					Strs("tagsRemoved", tagsToRemove).
					Msg("Successfully removed tags from torrent")
			}

			// Track the changes
			filterResult := FilterResult{
				TorrentHash:  torrent.Hash,
				TorrentName:  torrent.Name,
				TagsToAdd:    tagsToAdd,
				TagsToRemove: tagsToRemove,
				Reason:       fmt.Sprintf("Applied by TQM filters: %s", config.Name),
			}

			if retagInfo.UploadKb != nil {
				uploadKbInt := int(*retagInfo.UploadKb)
				filterResult.UploadLimit = &uploadKbInt
			}

			result.Results = append(result.Results, filterResult)
			result.TagsApplied += len(tagsToAdd)
			result.TagsRemoved += len(tagsToRemove)
		}
	}

	result.CompletedAt = time.Now()
	result.Duration = result.CompletedAt.Sub(startTime)

	// Count tags by name for summary
	tagCounts := make(map[string]int)
	for _, filterResult := range result.Results {
		for _, tag := range filterResult.TagsToAdd {
			tagCounts[tag]++
		}
	}

	log.Info().
		Int64("instanceId", c.instanceID).
		Int("torrentsProcessed", result.TorrentsProcessed).
		Int("tagsApplied", result.TagsApplied).
		Int("tagsRemoved", result.TagsRemoved).
		Interface("tagCounts", tagCounts).
		Dur("duration", result.Duration).
		Msg("TQM retag operation completed")

	return result, nil
}

// updateFilters updates the TQM client with new filter configuration
func (c *Client) updateFilters(config *Config) error {
	// Convert qui TagRules to TQM filter format
	tagConfigs := make([]struct {
		Name     string
		Mode     string
		UploadKb *int `mapstructure:"uploadKb"`
		Update   []string
	}, 0, len(config.Filters))

	log.Debug().
		Int("totalFilters", len(config.Filters)).
		Msg("Processing TQM filters")

	for _, rule := range config.Filters {
		log.Debug().
			Str("ruleName", rule.Name).
			Str("ruleMode", rule.Mode).
			Str("ruleExpression", rule.Expression).
			Bool("ruleEnabled", rule.Enabled).
			Msg("Processing TQM filter rule")

		if !rule.Enabled {
			log.Debug().
				Str("ruleName", rule.Name).
				Msg("Skipping disabled TQM filter rule")
			continue
		}

		// Validate expression
		if _, err := expr.Compile(rule.Expression); err != nil {
			log.Warn().
				Err(err).
				Str("expression", rule.Expression).
				Str("tagName", rule.Name).
				Msg("Invalid TQM expression, skipping rule")
			continue
		}

		tagConfig := struct {
			Name     string
			Mode     string
			UploadKb *int `mapstructure:"uploadKb"`
			Update   []string
		}{
			Name:   rule.Name,
			Mode:   rule.Mode,
			Update: []string{rule.Expression},
		}

		if rule.UploadKB != nil {
			tagConfig.UploadKb = rule.UploadKB
		}

		tagConfigs = append(tagConfigs, tagConfig)

		log.Debug().
			Str("tagName", tagConfig.Name).
			Str("tagMode", tagConfig.Mode).
			Strs("tagUpdate", tagConfig.Update).
			Msg("Added TQM tag config")
	}

	log.Debug().
		Int("totalTagConfigs", len(tagConfigs)).
		Msg("Created TQM tag configurations")

	filterConfig := &tqmConfig.FilterConfiguration{
		Tag: tagConfigs,
	}

	// Compile new filter configuration
	exp, err := tqmExpression.Compile(filterConfig)
	if err != nil {
		return fmt.Errorf("failed to compile updated filter config: %w", err)
	}

	// Configure TQM global config again (in case it was cleared)
	if err := c.configureTQMGlobalConfig(); err != nil {
		return fmt.Errorf("failed to configure TQM global config: %w", err)
	}

	// Create new TQM client with updated filters
	client, err := tqmClient.NewClient("qbittorrent", c.instance.Name, exp)
	if err != nil {
		return fmt.Errorf("failed to create updated TQM client: %w", err)
	}

	// Cast to TagInterface
	tagClient, ok := client.(tqmClient.TagInterface)
	if !ok {
		return fmt.Errorf("updated qBittorrent client does not implement TagInterface")
	}

	// Connect the new client
	if err := tagClient.Connect(context.Background()); err != nil {
		return fmt.Errorf("failed to connect updated TQM client: %w", err)
	}

	// Replace the existing client
	c.tqmClient = tagClient

	// Create tags for the new configuration
	if err := c.createTagsFromConfig(context.Background(), config); err != nil {
		log.Warn().
			Err(err).
			Int64("instanceId", c.instanceID).
			Msg("Failed to create tags from config, continuing anyway")
	}

	return nil
}

// Close closes the TQM client connection
func (c *Client) Close() error {
	if c.tqmClient != nil {
		c.isConnected = false
		// TQM client doesn't have an explicit close method
		c.tqmClient = nil
	}
	return nil
}

// createTagsUpfront creates all tags that will be used by TQM filters
func (c *Client) createTagsUpfront(ctx context.Context) error {
	if c.tqmClient == nil {
		return fmt.Errorf("TQM client not initialized")
	}

	// Extract tag names from the current default filters (unregistered, tracker-down)
	// These are the default tags that should always exist
	defaultTags := []string{"unregistered", "tracker-down"}

	if err := c.tqmClient.CreateTags(ctx, defaultTags); err != nil {
		return fmt.Errorf("failed to create default tags: %w", err)
	}

	log.Debug().
		Int64("instanceId", c.instanceID).
		Strs("tags", defaultTags).
		Msg("Created default TQM tags upfront")

	return nil
}

// createTagsFromConfig creates tags from the given configuration
func (c *Client) createTagsFromConfig(ctx context.Context, config *Config) error {
	if c.tqmClient == nil {
		return fmt.Errorf("TQM client not initialized")
	}

	// Extract tag names from config filters
	var tagNames []string
	for _, filter := range config.Filters {
		if filter.Enabled {
			tagNames = append(tagNames, filter.Name)
		}
	}

	if len(tagNames) == 0 {
		return nil
	}

	if err := c.tqmClient.CreateTags(ctx, tagNames); err != nil {
		return fmt.Errorf("failed to create config tags: %w", err)
	}

	log.Debug().
		Int64("instanceId", c.instanceID).
		Strs("tags", tagNames).
		Msg("Created TQM tags from config")

	return nil
}

// RetagResult represents the result of a retag operation
type RetagResult struct {
	StartedAt         time.Time      `json:"startedAt"`
	CompletedAt       time.Time      `json:"completedAt"`
	Duration          time.Duration  `json:"duration"`
	TorrentsProcessed int            `json:"torrentsProcessed"`
	TagsApplied       int            `json:"tagsApplied"`
	TagsRemoved       int            `json:"tagsRemoved"`
	Results           []FilterResult `json:"results"`
}
