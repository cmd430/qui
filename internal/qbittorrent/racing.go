// Copyright (c) 2025, s0up and the autobrr contributors.
// SPDX-License-Identifier: GPL-2.0-or-later

package qbittorrent

import (
	"context"
	"sort"
	"time"

	qbt "github.com/autobrr/go-qbittorrent"
	"github.com/rs/zerolog/log"
)

// RacingTorrent represents a torrent with racing metrics
type RacingTorrent struct {
	Hash           string     `json:"hash"`
	Name           string     `json:"name"`
	Size           int64      `json:"size"`
	Tracker        string     `json:"tracker"`
	TrackerDomain  string     `json:"trackerDomain"`
	Ratio          float64    `json:"ratio"`
	CompletionTime *int64     `json:"completionTime,omitempty"` // Time to complete in seconds
	AddedOn        time.Time  `json:"addedOn"`
	CompletedOn    *time.Time `json:"completedOn,omitempty"`
	State          string     `json:"state"`
	Category       string     `json:"category"`
	Tags           string     `json:"tags"`
}

// RacingDashboard represents the complete racing dashboard data
type RacingDashboard struct {
	TopFastest   []RacingTorrent `json:"topFastest"`   // Torrents that completed quickest
	TopRatios    []RacingTorrent `json:"topRatios"`    // Torrents with highest ratio
	BottomRatios []RacingTorrent `json:"bottomRatios"` // Torrents with lowest ratio
	TrackerStats TrackerStats    `json:"trackerStats"` // Statistics per tracker
	LastUpdated  time.Time       `json:"lastUpdated"`
}

// TrackerStats represents statistics for each tracker
type TrackerStats struct {
	TotalTorrents         int                    `json:"totalTorrents"`
	CompletedTorrents     int                    `json:"completedTorrents"`
	AverageRatio          float64                `json:"averageRatio"`
	AverageCompletionTime *int64                 `json:"averageCompletionTime,omitempty"`
	ByTracker             map[string]TrackerData `json:"byTracker"`
}

// TrackerData represents data for a specific tracker
type TrackerData struct {
	TotalTorrents         int     `json:"totalTorrents"`
	CompletedTorrents     int     `json:"completedTorrents"`
	AverageRatio          float64 `json:"averageRatio"`
	AverageCompletionTime *int64  `json:"averageCompletionTime,omitempty"`
}

// RacingDashboardOptions represents options for the racing dashboard
type RacingDashboardOptions struct {
	Limit          int      `json:"limit"`          // Number of torrents to show in each category (default: 5)
	TrackerFilter  []string `json:"trackerFilter"`  // Filter by specific trackers (empty = all)
	MinRatio       float64  `json:"minRatio"`       // Minimum ratio to include (default: 0)
	MinSize        int64    `json:"minSize"`        // Minimum size in bytes (default: 0)
	MaxSize        int64    `json:"maxSize"`        // Maximum size in bytes (default: 0 = no limit)
	CategoryFilter []string `json:"categoryFilter"` // Filter by categories (empty = all)
	StartDate      string   `json:"startDate"`      // Start date for filtering (ISO format)
	EndDate        string   `json:"endDate"`        // End date for filtering (ISO format)
	TimeRange      string   `json:"timeRange"`      // Preset time range (e.g., "24h", "7d", "30d")
}

// RacingManager manages racing dashboard functionality
type RacingManager struct {
	syncManager *SyncManager
}

// NewRacingManager creates a new racing manager
func NewRacingManager(syncManager *SyncManager) *RacingManager {
	return &RacingManager{
		syncManager: syncManager,
	}
}

// GetRacingDashboard generates the racing dashboard data
func (rm *RacingManager) GetRacingDashboard(ctx context.Context, instanceID int, options RacingDashboardOptions) (*RacingDashboard, error) {
	// Set defaults
	if options.Limit == 0 {
		options.Limit = 5
	}

	// Get all torrents from sync manager
	allTorrents, err := rm.syncManager.getAllTorrentsForStats(ctx, instanceID, "")
	if err != nil {
		return nil, err
	}

	// Convert to racing torrents and apply filters
	racingTorrents := rm.convertToRacingTorrents(allTorrents, options)

	// Calculate racing metrics
	dashboard := &RacingDashboard{
		LastUpdated: time.Now(),
	}

	// Get top fastest completed torrents
	dashboard.TopFastest = rm.getTopFastest(racingTorrents, options.Limit)

	// Get top ratios
	dashboard.TopRatios = rm.getTopRatios(racingTorrents, options.Limit)

	// Get bottom ratios
	dashboard.BottomRatios = rm.getBottomRatios(racingTorrents, options.Limit)

	// Calculate tracker statistics
	dashboard.TrackerStats = rm.calculateTrackerStats(racingTorrents)

	log.Debug().
		Int("instanceID", instanceID).
		Int("totalTorrents", len(racingTorrents)).
		Int("topFastest", len(dashboard.TopFastest)).
		Int("topRatios", len(dashboard.TopRatios)).
		Int("bottomRatios", len(dashboard.BottomRatios)).
		Msg("Generated racing dashboard")

	return dashboard, nil
}

// convertToRacingTorrents converts qbt.Torrent to RacingTorrent with filtering
func (rm *RacingManager) convertToRacingTorrents(torrents []qbt.Torrent, options RacingDashboardOptions) []RacingTorrent {
	var racingTorrents []RacingTorrent
	filtered := 0

	for _, torrent := range torrents {
		// Apply filters
		if !rm.matchesFilters(torrent, options) {
			filtered++
			continue
		}

		racingTorrent := RacingTorrent{
			Hash:     torrent.Hash,
			Name:     torrent.Name,
			Size:     torrent.Size,
			Tracker:  torrent.Tracker,
			State:    string(torrent.State),
			Category: torrent.Category,
			Tags:     torrent.Tags,
			Ratio:    torrent.Ratio,
			AddedOn:  time.Unix(torrent.AddedOn, 0),
		}

		// Extract tracker domain
		if torrent.Tracker != "" {
			racingTorrent.TrackerDomain = rm.syncManager.getDomainFromTracker(torrent.Tracker)
		}

		// Calculate completion time if torrent is completed
		if torrent.Progress == 1 && torrent.CompletionOn > 0 {
			racingTorrent.CompletedOn = &time.Time{}
			*racingTorrent.CompletedOn = time.Unix(torrent.CompletionOn, 0)

			// Calculate time to complete
			if torrent.CompletionOn > torrent.AddedOn {
				completionTime := torrent.CompletionOn - torrent.AddedOn
				racingTorrent.CompletionTime = &completionTime
			}
		}

		racingTorrents = append(racingTorrents, racingTorrent)
	}

	if options.TimeRange != "" {
		log.Info().
			Int("totalTorrents", len(torrents)).
			Int("filtered", filtered).
			Int("remaining", len(racingTorrents)).
			Str("timeRange", options.TimeRange).
			Msg("RACING TIME FILTER APPLIED")
	}

	return racingTorrents
}

// matchesFilters checks if a torrent matches the filter criteria
func (rm *RacingManager) matchesFilters(torrent qbt.Torrent, options RacingDashboardOptions) bool {
	// Size filters
	if options.MinSize > 0 && torrent.Size < options.MinSize {
		return false
	}
	if options.MaxSize > 0 && torrent.Size > options.MaxSize {
		return false
	}

	// Ratio filter
	if torrent.Ratio < options.MinRatio {
		return false
	}

	// Category filter
	if len(options.CategoryFilter) > 0 {
		found := false
		for _, category := range options.CategoryFilter {
			if torrent.Category == category {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	// Tracker filter
	if len(options.TrackerFilter) > 0 {
		trackerDomain := rm.syncManager.getDomainFromTracker(torrent.Tracker)
		found := false
		for _, tracker := range options.TrackerFilter {
			if trackerDomain == tracker || torrent.Tracker == tracker {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	// Apply time filtering using the shared helper
	if !matchesTimeFilter(torrent, options) {
		return false
	}

	return true
}

// getTopFastest returns the fastest completed torrents
func (rm *RacingManager) getTopFastest(torrents []RacingTorrent, limit int) []RacingTorrent {
	var completed []RacingTorrent

	// Filter to only completed torrents with completion time
	for _, torrent := range torrents {
		if torrent.CompletionTime != nil && *torrent.CompletionTime > 0 {
			completed = append(completed, torrent)
		}
	}

	// Sort by completion time (fastest first)
	sort.Slice(completed, func(i, j int) bool {
		return *completed[i].CompletionTime < *completed[j].CompletionTime
	})

	// Return top N
	if len(completed) > limit {
		return completed[:limit]
	}
	return completed
}

// getTopRatios returns torrents with highest ratio
func (rm *RacingManager) getTopRatios(torrents []RacingTorrent, limit int) []RacingTorrent {
	// Sort by ratio descending
	sorted := make([]RacingTorrent, len(torrents))
	copy(sorted, torrents)

	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Ratio > sorted[j].Ratio
	})

	// Return top N
	if len(sorted) > limit {
		return sorted[:limit]
	}
	return sorted
}

// getBottomRatios returns torrents with lowest ratio
func (rm *RacingManager) getBottomRatios(torrents []RacingTorrent, limit int) []RacingTorrent {
	// Sort by ratio ascending
	sorted := make([]RacingTorrent, len(torrents))
	copy(sorted, torrents)

	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Ratio < sorted[j].Ratio
	})

	// Return bottom N
	if len(sorted) > limit {
		return sorted[:limit]
	}
	return sorted
}

// calculateTrackerStats calculates statistics per tracker
func (rm *RacingManager) calculateTrackerStats(torrents []RacingTorrent) TrackerStats {
	stats := TrackerStats{
		ByTracker: make(map[string]TrackerData),
	}

	totalRatio := 0.0
	totalCompletionTime := int64(0)
	completedCount := 0

	for _, torrent := range torrents {
		stats.TotalTorrents++

		// Use tracker domain for grouping, fallback to "Unknown"
		trackerKey := torrent.TrackerDomain
		if trackerKey == "" {
			trackerKey = "Unknown"
		}

		// Initialize tracker data if not exists
		if _, exists := stats.ByTracker[trackerKey]; !exists {
			stats.ByTracker[trackerKey] = TrackerData{}
		}

		trackerData := stats.ByTracker[trackerKey]
		trackerData.TotalTorrents++

		// Track ratio
		totalRatio += torrent.Ratio
		trackerData.AverageRatio += torrent.Ratio

		// Track completion time
		if torrent.CompletionTime != nil {
			stats.CompletedTorrents++
			trackerData.CompletedTorrents++
			totalCompletionTime += *torrent.CompletionTime
			trackerData.AverageCompletionTime = new(int64)
			if trackerData.AverageCompletionTime != nil {
				*trackerData.AverageCompletionTime += *torrent.CompletionTime
			}
		}

		stats.ByTracker[trackerKey] = trackerData
	}

	// Calculate averages
	if stats.TotalTorrents > 0 {
		stats.AverageRatio = totalRatio / float64(stats.TotalTorrents)
	}

	if completedCount > 0 {
		avgTime := totalCompletionTime / int64(completedCount)
		stats.AverageCompletionTime = &avgTime
	}

	// Calculate per-tracker averages
	for tracker, data := range stats.ByTracker {
		if data.TotalTorrents > 0 {
			data.AverageRatio = data.AverageRatio / float64(data.TotalTorrents)
		}
		if data.CompletedTorrents > 0 && data.AverageCompletionTime != nil {
			*data.AverageCompletionTime = *data.AverageCompletionTime / int64(data.CompletedTorrents)
		}
		stats.ByTracker[tracker] = data
	}

	return stats
}
