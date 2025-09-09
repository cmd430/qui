// Copyright (c) 2025, s0up and the autobrr contributors.
// SPDX-License-Identifier: GPL-2.0-or-later

package qbittorrent

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	qbt "github.com/autobrr/go-qbittorrent"
	"github.com/rs/zerolog/log"
)

// EconomyScore represents a torrent's economy score and related metrics
type EconomyScore struct {
	Hash                string   `json:"hash"`
	Name                string   `json:"name"`
	Size                int64    `json:"size"`
	Seeds               int      `json:"seeds"`
	Peers               int      `json:"peers"`
	Ratio               float64  `json:"ratio"`
	Age                 int64    `json:"age"`          // Age in days
	EconomyScore        float64  `json:"economyScore"` // Retention-based score (higher = keep longer)
	StorageValue        float64  `json:"storageValue"`
	RarityBonus         float64  `json:"rarityBonus"`
	DeduplicationFactor float64  `json:"deduplicationFactor"`
	ReviewPriority      float64  `json:"reviewPriority"`       // Priority for review (lower = needs more attention)
	Duplicates          []string `json:"duplicates,omitempty"` // Hash of duplicate torrents
	Tracker             string   `json:"tracker"`
	State               string   `json:"state"`
	Category            string   `json:"category"`
	LastActivity        int64    `json:"lastActivity"`
}

// EconomyStats represents aggregated economy statistics
type EconomyStats struct {
	TotalTorrents        int     `json:"totalTorrents"`
	TotalStorage         int64   `json:"totalStorage"`
	DeduplicatedStorage  int64   `json:"deduplicatedStorage"`
	StorageSavings       int64   `json:"storageSavings"`
	AverageEconomyScore  float64 `json:"averageEconomyScore"`
	HighValueTorrents    int     `json:"highValueTorrents"`
	RareContentCount     int     `json:"rareContentCount"`
	WellSeededOldContent int     `json:"wellSeededOldContent"`
}

// OptimizationOpportunity represents a specific optimization opportunity
type OptimizationOpportunity struct {
	Type        string   `json:"type"` // "cross_seeding_opportunity", "old_content_cleanup", "ratio_optimization", etc.
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Priority    string   `json:"priority"` // "high", "medium", "low"
	Savings     int64    `json:"savings"`  // Storage savings in bytes
	Impact      float64  `json:"impact"`   // Impact score (0-100)
	Torrents    []string `json:"torrents"` // Affected torrent hashes
	Category    string   `json:"category"` // "storage", "seeding", "ratio"
}

// StorageOptimization represents storage-related optimization data
type StorageOptimization struct {
	TotalPotentialSavings    int64 `json:"totalPotentialSavings"`
	DeduplicationSavings     int64 `json:"deduplicationSavings"`
	OldContentCleanupSavings int64 `json:"oldContentCleanupSavings"`
	RatioOptimizationSavings int64 `json:"ratioOptimizationSavings"`
	UnusedContentSavings     int64 `json:"unusedContentSavings"`
}

// TorrentGroup represents a group of related torrents (duplicates)
type TorrentGroup struct {
	ID                string         `json:"id"`                // Unique group identifier
	Torrents          []EconomyScore `json:"torrents"`          // All torrents in this group
	PrimaryTorrent    EconomyScore   `json:"primaryTorrent"`    // The "best" torrent in the group
	GroupType         string         `json:"groupType"`         // "duplicate", "unique", "last_seed"
	TotalSize         int64          `json:"totalSize"`         // Combined size of all torrents in group
	DeduplicatedSize  int64          `json:"deduplicatedSize"`  // Size if keeping only the best copy
	PotentialSavings  int64          `json:"potentialSavings"`  // Size that could be saved
	RecommendedAction string         `json:"recommendedAction"` // "keep_all", "keep_best", "preserve"
	Priority          int            `json:"priority"`          // Group priority for review (1=highest)
}

// PaginationInfo contains pagination metadata
type PaginationInfo struct {
	Page        int  `json:"page"`
	PageSize    int  `json:"pageSize"`
	TotalItems  int  `json:"totalItems"`
	TotalPages  int  `json:"totalPages"`
	HasNextPage bool `json:"hasNextPage"`
	HasPrevPage bool `json:"hasPrevPage"`
}

// PaginatedReviewTorrents contains paginated review torrent data
type PaginatedReviewTorrents struct {
	Torrents        []EconomyScore   `json:"torrents"`      // Individual torrents for flat view
	Groups          [][]EconomyScore `json:"groups"`        // Legacy grouped view
	TorrentGroups   []TorrentGroup   `json:"torrentGroups"` // Enhanced grouped view with metadata
	Pagination      PaginationInfo   `json:"pagination"`
	GroupingEnabled bool             `json:"groupingEnabled"` // Whether grouping should be used in UI
}

// EconomyAnalysis represents the complete economy analysis
type EconomyAnalysis struct {
	Scores              []EconomyScore            `json:"scores"`
	Stats               EconomyStats              `json:"stats"`
	TopValuable         []EconomyScore            `json:"topValuable"`
	Duplicates          map[string][]string       `json:"duplicates"` // Map of content hash to torrent hashes
	Optimizations       []OptimizationOpportunity `json:"optimizations"`
	StorageOptimization StorageOptimization       `json:"storageOptimization"`
	ReviewTorrents      PaginatedReviewTorrents   `json:"reviewTorrents"`  // Full review torrents and groups
	ReviewThreshold     float64                   `json:"reviewThreshold"` // Threshold used for review filtering
}

// EconomyService handles torrent economy calculations
type EconomyService struct {
	syncManager *SyncManager
}

// NewEconomyService creates a new economy service
func NewEconomyService(syncManager *SyncManager) *EconomyService {
	return &EconomyService{
		syncManager: syncManager,
	}
}

// AnalyzeEconomy performs a complete economy analysis for an instance
func (es *EconomyService) AnalyzeEconomy(ctx context.Context, instanceID int) (*EconomyAnalysis, error) {
	// Get all torrents
	torrents, err := es.getAllTorrents(ctx, instanceID)
	if err != nil {
		return nil, fmt.Errorf("failed to get torrents: %w", err)
	}

	if len(torrents) == 0 {
		return &EconomyAnalysis{
			Scores:              []EconomyScore{},
			Stats:               EconomyStats{},
			TopValuable:         []EconomyScore{},
			Duplicates:          make(map[string][]string),
			Optimizations:       []OptimizationOpportunity{},
			StorageOptimization: StorageOptimization{},
		}, nil
	}

	// Calculate economy scores
	scores := es.calculateEconomyScores(torrents)

	// Find duplicates
	duplicates := es.findDuplicates(torrents)

	// Update scores with deduplication factors
	scores = es.applyDeduplicationFactors(scores, duplicates)

	// Sort by economy score (highest first) for top valuable calculation
	sortedScores := make([]EconomyScore, len(scores))
	copy(sortedScores, scores)
	sort.Slice(sortedScores, func(i, j int) bool {
		return sortedScores[i].EconomyScore > sortedScores[j].EconomyScore
	})

	// Calculate statistics
	stats := es.calculateStats(scores, duplicates)

	// Calculate optimization opportunities
	optimizations := es.calculateOptimizationOpportunities(scores, duplicates)

	// Calculate storage optimization data
	storageOptimization := es.calculateStorageOptimization(scores, duplicates)

	// Get top valuable torrents (from sorted copy)
	topValuable := sortedScores
	if len(topValuable) > 20 {
		topValuable = topValuable[:20]
	}

	// Calculate review threshold and filter review torrents
	reviewThreshold := es.calculateReviewThreshold(scores)
	reviewTorrents := es.buildReviewTorrents(scores, reviewThreshold)

	// Create torrent groups (legacy format)
	torrentGroups := es.createTorrentGroups(reviewTorrents)

	// Create enhanced torrent groups with metadata
	enhancedGroups := es.createEnhancedTorrentGroups(reviewTorrents, duplicates)

	// Create full review torrents data (not paginated)
	fullReviewTorrents := PaginatedReviewTorrents{
		Torrents:        reviewTorrents,
		Groups:          torrentGroups,
		TorrentGroups:   enhancedGroups,
		GroupingEnabled: len(enhancedGroups) > 0 && len(enhancedGroups) < len(reviewTorrents), // Enable if we have groups with multiple items
		Pagination: PaginationInfo{
			Page:        1,
			PageSize:    len(reviewTorrents),
			TotalItems:  len(reviewTorrents),
			TotalPages:  1,
			HasNextPage: false,
			HasPrevPage: false,
		},
	}

	return &EconomyAnalysis{
		Scores:              scores,
		Stats:               stats,
		TopValuable:         topValuable,
		Duplicates:          duplicates,
		Optimizations:       optimizations,
		StorageOptimization: storageOptimization,
		ReviewTorrents:      fullReviewTorrents,
		ReviewThreshold:     reviewThreshold,
	}, nil
}

// getAllTorrents gets all torrents for analysis
func (es *EconomyService) getAllTorrents(ctx context.Context, instanceID int) ([]qbt.Torrent, error) {
	// Get fresh data from sync manager
	_, syncManager, err := es.syncManager.getClientAndSyncManager(ctx, instanceID)
	if err != nil {
		return nil, err
	}

	// Get all torrents
	torrentFilterOptions := qbt.TorrentFilterOptions{
		Filter: qbt.TorrentFilterAll,
	}

	torrents := syncManager.GetTorrents(torrentFilterOptions)
	log.Debug().
		Int("instanceID", instanceID).
		Int("torrentCount", len(torrents)).
		Msg("Retrieved torrents for economy analysis")

	return torrents, nil
}

// calculateEconomyScores calculates economy scores for all torrents
func (es *EconomyService) calculateEconomyScores(torrents []qbt.Torrent) []EconomyScore {
	scores := make([]EconomyScore, len(torrents))

	for i, torrent := range torrents {
		score := es.calculateSingleEconomyScore(torrent)
		scores[i] = score
	}

	return scores
}

// calculateSingleEconomyScore calculates the economy score for a single torrent
func (es *EconomyService) calculateSingleEconomyScore(torrent qbt.Torrent) EconomyScore {
	now := time.Now()
	addedTime := time.Unix(torrent.AddedOn, 0)
	ageInDays := int64(now.Sub(addedTime).Hours() / 24)
	lastActivityTime := time.Unix(torrent.LastActivity, 0)
	daysSinceActivity := int64(now.Sub(lastActivityTime).Hours() / 24)

	// Base storage value (size in GB)
	storageValue := float64(torrent.Size) / (1024 * 1024 * 1024)

	// Calculate retention score based on age and other factors
	retentionScore := es.calculateRetentionScore(torrent, ageInDays, daysSinceActivity)

	// Rarity bonus based on seed count (inverse relationship)
	var rarityBonus float64
	if torrent.NumSeeds == 0 {
		rarityBonus = 10.0 // Extremely rare
	} else if torrent.NumSeeds < 5 {
		rarityBonus = 5.0 // Very rare
	} else if torrent.NumSeeds < 10 {
		rarityBonus = 2.0 // Rare
	} else if torrent.NumSeeds < 50 {
		rarityBonus = 1.0 // Moderately rare
	} else {
		rarityBonus = 0.1 // Common
	}

	// Calculate final economy score (retention-based, higher = keep longer)
	economyScore := retentionScore

	return EconomyScore{
		Hash:                torrent.Hash,
		Name:                torrent.Name,
		Size:                torrent.Size,
		Seeds:               int(torrent.NumSeeds),
		Peers:               int(torrent.NumLeechs),
		Ratio:               torrent.Ratio,
		Age:                 ageInDays,
		EconomyScore:        economyScore,
		StorageValue:        storageValue,
		RarityBonus:         rarityBonus,
		DeduplicationFactor: 1.0,          // Will be updated later
		ReviewPriority:      economyScore, // Use economy score for review priority
		Tracker:             torrent.Tracker,
		State:               string(torrent.State),
		Category:            torrent.Category,
		LastActivity:        torrent.LastActivity,
	}
}

// calculateRetentionScore calculates how long content should be retained
// This is the base score before considering duplicates - will be adjusted later for duplicate vs unique torrents
func (es *EconomyService) calculateRetentionScore(torrent qbt.Torrent, ageInDays, daysSinceActivity int64) float64 {
	// Base retention score starts high for new content
	baseRetention := 100.0

	// Age factor: content loses retention value over time
	ageFactor := 1.0
	if ageInDays > 7 {
		// Gradual decline after 1 week
		ageFactor = math.Max(0.1, math.Pow(0.98, float64(ageInDays-7)))
	}

	// Activity factor: recent activity increases retention value
	activityBonus := 1.0
	if daysSinceActivity < 1 {
		activityBonus = 2.0 // Very recent activity
	} else if daysSinceActivity < 7 {
		activityBonus = 1.5 // Recent activity
	} else if daysSinceActivity < 30 {
		activityBonus = 1.2 // Somewhat recent
	} else if daysSinceActivity > 90 {
		activityBonus = 0.5 // Very old activity
	}

	// Ratio factor: better ratio = higher retention
	ratioFactor := 1.0
	if torrent.Ratio > 2.0 {
		ratioFactor = 1.3 // Excellent ratio
	} else if torrent.Ratio > 1.0 {
		ratioFactor = 1.1 // Good ratio
	} else if torrent.Ratio < 0.3 {
		ratioFactor = 0.7 // Poor ratio
	}

	// Category factor: some categories should be retained longer
	categoryFactor := 1.0
	category := strings.ToLower(torrent.Category)
	if strings.Contains(category, "movie") || strings.Contains(category, "tv") {
		categoryFactor = 1.2 // Entertainment content
	} else if strings.Contains(category, "music") || strings.Contains(category, "audio") {
		categoryFactor = 1.1 // Music
	} else if strings.Contains(category, "book") || strings.Contains(category, "documentary") {
		categoryFactor = 1.3 // Educational/Documentary
	}

	// NOTE: Seed factor will be applied later in applyDeduplicationFactors based on whether torrent is unique or duplicate
	// For now, we don't apply seed factor here since it depends on duplicate status

	// Calculate base retention score without seed factor
	retentionScore := baseRetention * ageFactor * activityBonus * ratioFactor * categoryFactor

	return retentionScore
}

// findDuplicates finds duplicate content based on name similarity and size
func (es *EconomyService) findDuplicates(torrents []qbt.Torrent) map[string][]string {
	duplicates := make(map[string][]string)

	// Group by normalized name and size range
	contentGroups := make(map[string][]qbt.Torrent)

	for _, torrent := range torrents {
		// Normalize name for comparison
		normalizedName := es.normalizeContentName(torrent.Name)

		// Create size bucket (within 10% of size)
		sizeBucket := int64(float64(torrent.Size) / (1024 * 1024 * 1024) * 10) // GB buckets

		key := fmt.Sprintf("%s_%d", normalizedName, sizeBucket)
		contentGroups[key] = append(contentGroups[key], torrent)
	}

	// Find groups with multiple torrents
	for _, group := range contentGroups {
		if len(group) > 1 {
			hashes := make([]string, len(group))
			for i, torrent := range group {
				hashes[i] = torrent.Hash
			}

			// Use first hash as key
			duplicates[hashes[0]] = hashes[1:]
		}
	}

	log.Debug().
		Int("duplicateGroups", len(duplicates)).
		Msg("Found duplicate content groups")

	return duplicates
}

// normalizeContentName normalizes a torrent name for duplicate detection
func (es *EconomyService) normalizeContentName(name string) string {
	// Remove common patterns
	name = strings.ToLower(name)

	// Remove quality indicators
	patterns := []string{
		"\\[.*?\\]", "\\(.*?\\)", "1080p", "720p", "480p", "2160p", "4k",
		"bluray", "webrip", "hdtv", "x264", "x265", "hevc", "aac", "ac3",
		"mp4", "mkv", "avi", "s01e", "s02e", "s03e", "season", "episode",
		"complete", "collection", "pack", "batch",
	}

	for _, pattern := range patterns {
		name = strings.ReplaceAll(name, pattern, "")
	}

	// Remove extra spaces and punctuation
	fields := strings.FieldsFunc(name, func(r rune) bool {
		return !((r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == ' ')
	})
	name = strings.Join(fields, " ")

	return strings.ToLower(name)
}

// applyDeduplicationFactors updates economy scores based on duplicates
func (es *EconomyService) applyDeduplicationFactors(scores []EconomyScore, duplicates map[string][]string) []EconomyScore {
	scoreMap := make(map[string]*EconomyScore)
	for i := range scores {
		scoreMap[scores[i].Hash] = &scores[i]
	}

	// Create a set of all duplicate hashes for quick lookup
	duplicateHashes := make(map[string]bool)
	for primaryHash, dupHashes := range duplicates {
		duplicateHashes[primaryHash] = true
		for _, hash := range dupHashes {
			duplicateHashes[hash] = true
		}
	}

	// First, apply seed factors and duplicate bonuses to all torrents
	for i := range scores {
		score := &scores[i]

		// Apply seed factor based on duplicate status
		seedFactor := 1.0
		if duplicateHashes[score.Hash] {
			// For duplicates: Seeds don't matter much since they're "free" storage
			// But if we're the last seed (0 seeds reported), it's extremely valuable
			if score.Seeds == 0 {
				seedFactor = 1.5 // EXTRA bonus for being the last seed of duplicate content
			} else {
				seedFactor = 1.0 // All live duplicates are equally valuable regardless of seeds
			}

			// Duplicates get a significant bonus for being "free" storage
			duplicateBonus := 2.5 // Major bonus for duplicates
			score.EconomyScore = score.EconomyScore * seedFactor * duplicateBonus
		} else {
			// For unique torrents: Well-seeded old content should score LOWEST
			// Poorly seeded old content should score low but not as low as well-seeded
			if score.Seeds == 0 {
				// If we're seeding and it shows 0 seeds, WE ARE THE LAST SEED - extremely valuable!
				seedFactor = 3.0 // Major bonus for being the sole remaining seed
			} else if score.Seeds > 10 {
				// Well-seeded unique torrents get penalized (especially old ones)
				if score.Age > 30 {
					seedFactor = 0.3 // Heavy penalty for old well-seeded unique content
				} else if score.Age > 7 {
					seedFactor = 0.6 // Medium penalty for moderately old well-seeded unique content
				} else {
					seedFactor = 0.8 // Light penalty for new well-seeded unique content
				}
			} else if score.Seeds > 5 {
				// Moderately seeded unique torrents get some penalty
				if score.Age > 30 {
					seedFactor = 0.5
				} else {
					seedFactor = 0.7
				}
			} else {
				// Poorly seeded unique torrents (1-5 seeds) are more valuable than well-seeded
				// because they need our help more
				if score.Age > 30 {
					seedFactor = 0.7 // Still penalized for age, but less than well-seeded
				} else {
					seedFactor = 1.0 // Keep at base level
				}
			}

			score.EconomyScore = score.EconomyScore * seedFactor
		}
	}

	// Now handle duplicate groupings for storage optimization purposes
	for primaryHash, duplicateHashes := range duplicates {
		primaryScore, exists := scoreMap[primaryHash]
		if !exists {
			continue
		}

		// Find the best copy in this duplicate group (highest economy score after adjustments)
		bestHash := primaryHash
		bestScore := primaryScore.EconomyScore

		// Check all duplicates for higher economy score
		allHashes := append([]string{primaryHash}, duplicateHashes...)
		for _, hash := range allHashes {
			if score := scoreMap[hash]; score != nil {
				if score.EconomyScore > bestScore {
					bestHash = hash
					bestScore = score.EconomyScore
				}
			}
		}

		// For storage optimization: mark the best copy as the "keeper" and others as potential removes
		// But all duplicates keep their high economy scores for retention decisions
		for _, hash := range allHashes {
			if score := scoreMap[hash]; score != nil {
				if hash == bestHash {
					// Best copy is the keeper for storage purposes
					score.DeduplicationFactor = 1.0
					score.Duplicates = make([]string, 0)
					for _, h := range allHashes {
						if h != bestHash {
							score.Duplicates = append(score.Duplicates, h)
						}
					}
					// Keep full review priority (economy score is already high due to duplicate bonus)
					score.ReviewPriority = score.EconomyScore
				} else {
					// Other copies are marked for potential storage optimization
					score.DeduplicationFactor = 0.0 // Mark as potential duplicate removal
					// Keep high review priority since duplicates are valuable
					// But slightly reduce it so the "best" copy is preferred
					score.ReviewPriority = score.EconomyScore * 0.95

					// Populate duplicates array for all copies in the group
					score.Duplicates = make([]string, 0)
					for _, h := range allHashes {
						if h != hash { // Don't include self
							score.Duplicates = append(score.Duplicates, h)
						}
					}
				}
			}
		}
	}

	// Set review priority for unique torrents (they already have their adjusted economy scores)
	for i := range scores {
		score := &scores[i]
		if !duplicateHashes[score.Hash] {
			// This is a unique torrent - use the economy score as review priority
			// Low economy score = high review priority (needs more attention)
			score.ReviewPriority = score.EconomyScore
		}
	}

	return scores
}

// calculateStats calculates aggregated economy statistics
func (es *EconomyService) calculateStats(scores []EconomyScore, duplicates map[string][]string) EconomyStats {
	if len(scores) == 0 {
		return EconomyStats{}
	}

	var totalStorage int64
	var deduplicatedStorage int64
	var totalEconomyScore float64
	var highValueCount int
	var rareContentCount int
	var wellSeededOldCount int

	// Create a set of duplicate hashes for quick lookup
	duplicateHashes := make(map[string]bool)
	for _, dupHashes := range duplicates {
		for _, hash := range dupHashes {
			duplicateHashes[hash] = true
		}
	}

	// For deduplicated storage, we need to count:
	// - All non-duplicate torrents (full size)
	// - Only the best copy from each duplicate group (full size)
	// - Other duplicates contribute 0

	// First, identify which torrents to count in deduplicated storage
	countedHashes := make(map[string]bool)

	// Add all non-duplicates
	for _, score := range scores {
		if !duplicateHashes[score.Hash] {
			countedHashes[score.Hash] = true
		}
	}

	// For each duplicate group, add only the best copy
	for primaryHash, dupHashes := range duplicates {
		allHashes := append([]string{primaryHash}, dupHashes...)

		// Find the best copy (highest economy score)
		bestHash := primaryHash
		bestScore := float64(-1)

		for _, hash := range allHashes {
			for _, score := range scores {
				if score.Hash == hash && score.EconomyScore > bestScore {
					bestHash = hash
					bestScore = score.EconomyScore
					break
				}
			}
		}

		countedHashes[bestHash] = true
	}

	// Now calculate stats
	for _, score := range scores {
		totalStorage += score.Size
		totalEconomyScore += score.EconomyScore

		// Only count the selected torrents in deduplicated storage
		if countedHashes[score.Hash] {
			deduplicatedStorage += score.Size
		}

		if score.EconomyScore > 50.0 { // Adjusted threshold for new scoring system
			highValueCount++
		}

		if score.Seeds < 5 {
			rareContentCount++
		}

		if score.Seeds > 10 && score.Age > 30 {
			wellSeededOldCount++
		}
	}

	storageSavings := totalStorage - deduplicatedStorage

	return EconomyStats{
		TotalTorrents:        len(scores),
		TotalStorage:         totalStorage,
		DeduplicatedStorage:  deduplicatedStorage,
		StorageSavings:       storageSavings,
		AverageEconomyScore:  totalEconomyScore / float64(len(scores)),
		HighValueTorrents:    highValueCount,
		RareContentCount:     rareContentCount,
		WellSeededOldContent: wellSeededOldCount,
	}
}

// calculateOptimizationOpportunities identifies specific optimization opportunities
func (es *EconomyService) calculateOptimizationOpportunities(scores []EconomyScore, duplicates map[string][]string) []OptimizationOpportunity {
	var opportunities []OptimizationOpportunity

	// Create a map for quick score lookup
	scoreMap := make(map[string]*EconomyScore)
	for i := range scores {
		scoreMap[scores[i].Hash] = &scores[i]
	}

	// 1. Duplicate removal opportunities - keep the most valuable copy of each group
	if len(duplicates) > 0 {
		var duplicateHashesToRemove []string
		var totalSavings int64

		for primaryHash, dupHashes := range duplicates {
			primaryScore := scoreMap[primaryHash]
			if primaryScore == nil {
				continue
			}

			// Find the most valuable copy in this duplicate group
			bestHash := primaryHash
			bestScore := primaryScore.EconomyScore

			// Check all duplicates for higher economy score
			allHashes := append([]string{primaryHash}, dupHashes...)
			for _, hash := range allHashes {
				if score := scoreMap[hash]; score != nil {
					if score.EconomyScore > bestScore {
						bestHash = hash
						bestScore = score.EconomyScore
					}
				}
			}

			// Remove all copies except the best one
			for _, hash := range allHashes {
				if hash != bestHash {
					if score := scoreMap[hash]; score != nil {
						duplicateHashesToRemove = append(duplicateHashesToRemove, hash)
						totalSavings += score.Size
					}
				}
			}
		}

		if len(duplicateHashesToRemove) > 0 {
			opportunities = append(opportunities, OptimizationOpportunity{
				Type:        "cross_seeding_opportunity",
				Title:       "Remove Duplicate Content",
				Description: fmt.Sprintf("Remove %d duplicate torrents while keeping the most valuable copy of each content group", len(duplicateHashesToRemove)),
				Priority:    "high",
				Savings:     totalSavings,
				Impact:      85.0,
				Torrents:    duplicateHashesToRemove,
				Category:    "storage",
			})
		}
	}

	// 2. Old well-seeded unique content cleanup - these now have the lowest scores and are least desired
	var oldWellSeededHashes []string
	var oldWellSeededSize int64

	// Create set of all duplicate hashes for quick lookup
	duplicateHashSet := make(map[string]bool)
	for primaryHash, dupHashes := range duplicates {
		duplicateHashSet[primaryHash] = true
		for _, hash := range dupHashes {
			duplicateHashSet[hash] = true
		}
	}

	for _, score := range scores {
		// Target unique (non-duplicate) torrents that are old, well-seeded, and have low economy scores
		// These are the least desired according to the new scoring logic
		if !duplicateHashSet[score.Hash] && score.Seeds > 10 && score.Age > 60 && score.EconomyScore < 30.0 {
			oldWellSeededHashes = append(oldWellSeededHashes, score.Hash)
			oldWellSeededSize += score.Size
		}
	}

	if len(oldWellSeededHashes) > 0 {
		savings := int64(float64(oldWellSeededSize) * 0.8) // Assume 80% can be cleaned up
		opportunities = append(opportunities, OptimizationOpportunity{
			Type:        "old_content_cleanup",
			Title:       "Clean Up Old Well-Seeded Unique Content",
			Description: fmt.Sprintf("Remove %d old, well-seeded unique torrents that are easily replaceable and have low retention value", len(oldWellSeededHashes)),
			Priority:    "high", // Changed to high priority since these are now the least desired
			Savings:     savings,
			Impact:      75.0, // Increased impact
			Torrents:    oldWellSeededHashes,
			Category:    "storage",
		})
	}

	// 3. Ratio optimization opportunities
	var lowRatioHashes []string
	var lowRatioSize int64

	for _, score := range scores {
		if score.Ratio < 0.5 && score.State == "seeding" && score.Age > 7 { // Low ratio, actively seeding, not brand new
			lowRatioHashes = append(lowRatioHashes, score.Hash)
			lowRatioSize += score.Size
		}
	}

	if len(lowRatioHashes) > 0 {
		savings := int64(float64(lowRatioSize) * 0.6) // Assume 60% can be optimized
		opportunities = append(opportunities, OptimizationOpportunity{
			Type:        "ratio_optimization",
			Title:       "Optimize Low-Ratio Torrents",
			Description: fmt.Sprintf("Consider removing or reseeding %d torrents with poor upload/download ratios", len(lowRatioHashes)),
			Priority:    "medium",
			Savings:     savings,
			Impact:      55.0,
			Torrents:    lowRatioHashes,
			Category:    "seeding",
		})
	}

	// 4. Unused content opportunities
	var unusedHashes []string
	var unusedSize int64

	for _, score := range scores {
		if score.State == "paused" && score.LastActivity == 0 && score.Age > 30 { // Paused, never active, old
			unusedHashes = append(unusedHashes, score.Hash)
			unusedSize += score.Size
		}
	}

	if len(unusedHashes) > 0 {
		savings := int64(float64(unusedSize) * 0.9) // Assume 90% can be removed
		opportunities = append(opportunities, OptimizationOpportunity{
			Type:        "unused_content_cleanup",
			Title:       "Remove Unused Content",
			Description: fmt.Sprintf("Remove %d paused torrents that have never been active", len(unusedHashes)),
			Priority:    "low",
			Savings:     savings,
			Impact:      75.0,
			Torrents:    unusedHashes,
			Category:    "storage",
		})
	}

	// 5. Critical preservation - torrents where we're the last seed
	var lastSeedHashes []string
	var lastSeedSize int64

	for _, score := range scores {
		if score.Seeds == 0 { // We're the last seed - extremely critical
			lastSeedHashes = append(lastSeedHashes, score.Hash)
			lastSeedSize += score.Size
		}
	}

	if len(lastSeedHashes) > 0 {
		opportunities = append(opportunities, OptimizationOpportunity{
			Type:        "preserve_last_seed",
			Title:       "CRITICAL: Preserve Torrents Where We're The Last Seed",
			Description: fmt.Sprintf("NEVER REMOVE: %d torrents where we are the sole remaining seeder - removing these would make the content permanently unavailable", len(lastSeedHashes)),
			Priority:    "critical",    // New priority level
			Savings:     -lastSeedSize, // Negative savings = content to preserve
			Impact:      100.0,         // Maximum impact
			Torrents:    lastSeedHashes,
			Category:    "preservation",
		})
	}

	// 6. High-value content preservation - duplicates, rare unique content, and torrents where we're the last seed
	var highValueHashes []string
	var highValueSize int64

	for _, score := range scores {
		// High value includes:
		// - All duplicates (they have high economy scores due to duplicate bonus)
		// - Rare unique content with decent scores
		// - Any torrent where we're the last seed (0 seeds = we're the only one left)
		isDuplicate := duplicateHashSet[score.Hash]
		isLastSeed := score.Seeds == 0

		if (isDuplicate && score.EconomyScore > 50.0) ||
			(!isDuplicate && score.EconomyScore > 60.0 && score.Seeds < 5) ||
			isLastSeed { // Always preserve torrents where we're the last seed
			highValueHashes = append(highValueHashes, score.Hash)
			highValueSize += score.Size
		}
	}

	if len(highValueHashes) > 0 {
		opportunities = append(opportunities, OptimizationOpportunity{
			Type:        "preserve_rare_content",
			Title:       "Preserve Critical Content",
			Description: fmt.Sprintf("Ensure %d critical torrents (duplicates, rare unique content, and torrents where we're the last seed) are properly seeded and backed up", len(highValueHashes)),
			Priority:    "high",
			Savings:     -highValueSize, // Negative savings = content to preserve
			Impact:      95.0,
			Torrents:    highValueHashes,
			Category:    "seeding",
		})
	}

	// Sort by impact (highest first)
	sort.Slice(opportunities, func(i, j int) bool {
		return opportunities[i].Impact > opportunities[j].Impact
	})

	return opportunities
}

// calculateStorageOptimization calculates comprehensive storage optimization data
func (es *EconomyService) calculateStorageOptimization(scores []EconomyScore, duplicates map[string][]string) StorageOptimization {
	// Create a map for quick score lookup
	scoreMap := make(map[string]*EconomyScore)
	for i := range scores {
		scoreMap[scores[i].Hash] = &scores[i]
	}

	var deduplicationSavings int64
	var oldContentCleanupSavings int64
	var ratioOptimizationSavings int64
	var unusedContentSavings int64

	// Calculate deduplication savings - keep the most valuable copy of each group
	for primaryHash, dupHashes := range duplicates {
		primaryScore := scoreMap[primaryHash]
		if primaryScore == nil {
			continue
		}

		// Find the most valuable copy in this duplicate group
		bestHash := primaryHash
		bestScore := primaryScore.EconomyScore

		// Check all duplicates for higher economy score
		allHashes := append([]string{primaryHash}, dupHashes...)
		for _, hash := range allHashes {
			if score := scoreMap[hash]; score != nil {
				if score.EconomyScore > bestScore {
					bestHash = hash
					bestScore = score.EconomyScore
				}
			}
		}

		// Calculate savings from removing all copies except the best one
		for _, hash := range allHashes {
			if hash != bestHash {
				if score := scoreMap[hash]; score != nil {
					deduplicationSavings += score.Size
				}
			}
		}
	}

	// Calculate old content cleanup savings - target unique well-seeded old torrents (lowest scores)
	duplicateHashSet := make(map[string]bool)
	for primaryHash, dupHashes := range duplicates {
		duplicateHashSet[primaryHash] = true
		for _, hash := range dupHashes {
			duplicateHashSet[hash] = true
		}
	}

	for _, score := range scores {
		// Target unique (non-duplicate) torrents that are old, well-seeded, and have low economy scores
		if !duplicateHashSet[score.Hash] && score.Seeds > 10 && score.Age > 60 && score.EconomyScore < 30.0 {
			oldContentCleanupSavings += score.Size
		}
	}

	// Calculate ratio optimization savings
	for _, score := range scores {
		if score.Ratio < 0.5 && score.State == "seeding" && score.Age > 7 {
			ratioOptimizationSavings += score.Size
		}
	}

	// Calculate unused content savings
	for _, score := range scores {
		if score.State == "paused" && score.LastActivity == 0 && score.Age > 30 {
			unusedContentSavings += score.Size
		}
	}

	totalPotentialSavings := deduplicationSavings + oldContentCleanupSavings + ratioOptimizationSavings + unusedContentSavings

	return StorageOptimization{
		TotalPotentialSavings:    totalPotentialSavings,
		DeduplicationSavings:     deduplicationSavings,
		OldContentCleanupSavings: oldContentCleanupSavings,
		RatioOptimizationSavings: ratioOptimizationSavings,
		UnusedContentSavings:     unusedContentSavings,
	}
}

// formatBytes formats bytes into human readable format
func (es *EconomyService) formatBytes(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

// calculateReviewThreshold calculates the dynamic threshold for torrents needing review
func (es *EconomyService) calculateReviewThreshold(scores []EconomyScore) float64 {
	if len(scores) == 0 {
		return 50.0 // Default fallback for retention scores
	}

	// Calculate threshold as the 40th percentile of economy scores
	// This ensures we focus on the worst 40% of torrents (lowest retention scores)
	// With the new scoring, duplicates will have high scores, so this will mainly catch unique torrents
	sortedScores := make([]float64, len(scores))
	for i, score := range scores {
		sortedScores[i] = score.EconomyScore
	}
	sort.Float64s(sortedScores)

	// 40th percentile (bottom 40% lowest retention scores)
	thresholdIndex := int(float64(len(sortedScores)) * 0.40)
	if thresholdIndex >= len(sortedScores) {
		thresholdIndex = len(sortedScores) - 1
	}

	threshold := sortedScores[thresholdIndex]

	// Ensure threshold is reasonable for the new scoring system
	if threshold < 20.0 {
		threshold = 20.0 // Low retention for unique torrents
	} else if threshold > 100.0 {
		threshold = 100.0 // High retention (shouldn't happen with new penalties)
	}

	return threshold
}

// buildReviewTorrents builds the filtered and sorted list of torrents needing review
func (es *EconomyService) buildReviewTorrents(scores []EconomyScore, threshold float64) []EconomyScore {
	// Filter torrents that need review
	var reviewCandidates []EconomyScore
	for _, score := range scores {
		if score.EconomyScore < threshold {
			reviewCandidates = append(reviewCandidates, score)
		}
	}

	// Sort by review priority (lowest first = highest priority)
	sort.Slice(reviewCandidates, func(i, j int) bool {
		if reviewCandidates[i].ReviewPriority != reviewCandidates[j].ReviewPriority {
			return reviewCandidates[i].ReviewPriority < reviewCandidates[j].ReviewPriority
		}
		// Secondary sort: oldest content first (higher age = more likely to need review)
		return reviewCandidates[i].Age > reviewCandidates[j].Age
	})

	// Remove duplicates from the list (keep only the first occurrence of each hash)
	seenHashes := make(map[string]bool)
	var reviewTorrents []EconomyScore

	for _, torrent := range reviewCandidates {
		if !seenHashes[torrent.Hash] {
			reviewTorrents = append(reviewTorrents, torrent)
			seenHashes[torrent.Hash] = true
		}
	}

	return reviewTorrents
}

// createTorrentGroups groups torrents by their duplicate relationships for review
func (es *EconomyService) createTorrentGroups(reviewTorrents []EconomyScore) [][]EconomyScore {
	var groups [][]EconomyScore
	processed := make(map[string]bool)

	// Create a quick lookup map for review torrents
	reviewTorrentMap := make(map[string]EconomyScore)
	for _, torrent := range reviewTorrents {
		reviewTorrentMap[torrent.Hash] = torrent
	}

	for _, torrent := range reviewTorrents {
		if processed[torrent.Hash] {
			continue
		}

		var group []EconomyScore
		group = append(group, torrent)
		processed[torrent.Hash] = true

		// Add all duplicates of this torrent that are also in review torrents
		if len(torrent.Duplicates) > 0 {
			for _, dupHash := range torrent.Duplicates {
				if dupTorrent, exists := reviewTorrentMap[dupHash]; exists && !processed[dupHash] {
					group = append(group, dupTorrent)
					processed[dupHash] = true
				}
			}
		}

		// Also check if this torrent is listed as a duplicate of others
		// This handles cases where the duplicate relationship might not be bidirectional in the data
		for _, reviewTorrent := range reviewTorrents {
			if processed[reviewTorrent.Hash] {
				continue
			}
			if reviewTorrent.Duplicates != nil {
				for _, dupHash := range reviewTorrent.Duplicates {
					if dupHash == torrent.Hash {
						group = append(group, reviewTorrent)
						processed[reviewTorrent.Hash] = true
						break
					}
				}
			}
		}

		// Sort group by review priority (lowest first = highest priority for review)
		// Then by economy score (highest first = most valuable)
		sort.Slice(group, func(i, j int) bool {
			if group[i].ReviewPriority != group[j].ReviewPriority {
				return group[i].ReviewPriority < group[j].ReviewPriority
			}
			return group[i].EconomyScore > group[j].EconomyScore
		})

		groups = append(groups, group)
	}

	// Sort groups by the priority of their highest-priority member (lowest review priority first)
	sort.Slice(groups, func(i, j int) bool {
		if len(groups[i]) == 0 || len(groups[j]) == 0 {
			return len(groups[i]) > len(groups[j])
		}
		// Compare by the most urgent torrent in each group
		return groups[i][0].ReviewPriority < groups[j][0].ReviewPriority
	})

	return groups
}

// createEnhancedTorrentGroups creates enhanced torrent groups with metadata for the frontend
func (es *EconomyService) createEnhancedTorrentGroups(reviewTorrents []EconomyScore, duplicates map[string][]string) []TorrentGroup {
	var enhancedGroups []TorrentGroup
	processed := make(map[string]bool)
	groupID := 1

	// Create a quick lookup map for review torrents
	reviewTorrentMap := make(map[string]EconomyScore)
	for _, torrent := range reviewTorrents {
		reviewTorrentMap[torrent.Hash] = torrent
	}

	// Create a set of all duplicate hashes for quick lookup
	duplicateHashSet := make(map[string]bool)
	for primaryHash, dupHashes := range duplicates {
		duplicateHashSet[primaryHash] = true
		for _, hash := range dupHashes {
			duplicateHashSet[hash] = true
		}
	}

	for _, torrent := range reviewTorrents {
		if processed[torrent.Hash] {
			continue
		}

		var groupTorrents []EconomyScore
		groupTorrents = append(groupTorrents, torrent)
		processed[torrent.Hash] = true

		// Add all duplicates of this torrent that are also in review torrents
		if len(torrent.Duplicates) > 0 {
			for _, dupHash := range torrent.Duplicates {
				if dupTorrent, exists := reviewTorrentMap[dupHash]; exists && !processed[dupHash] {
					groupTorrents = append(groupTorrents, dupTorrent)
					processed[dupHash] = true
				}
			}
		}

		// Also check if this torrent is listed as a duplicate of others
		for _, reviewTorrent := range reviewTorrents {
			if processed[reviewTorrent.Hash] {
				continue
			}
			if reviewTorrent.Duplicates != nil {
				for _, dupHash := range reviewTorrent.Duplicates {
					if dupHash == torrent.Hash {
						groupTorrents = append(groupTorrents, reviewTorrent)
						processed[reviewTorrent.Hash] = true
						break
					}
				}
			}
		}

		// Sort group members by economy score (highest first = most valuable)
		sort.Slice(groupTorrents, func(i, j int) bool {
			if groupTorrents[i].EconomyScore != groupTorrents[j].EconomyScore {
				return groupTorrents[i].EconomyScore > groupTorrents[j].EconomyScore
			}
			return groupTorrents[i].ReviewPriority < groupTorrents[j].ReviewPriority
		})

		// Determine group type and recommended action
		groupType := "unique"
		recommendedAction := "review"
		hasLastSeed := false

		for _, t := range groupTorrents {
			if t.Seeds == 0 {
				hasLastSeed = true
				break
			}
		}

		if len(groupTorrents) > 1 {
			groupType = "duplicate"
			if hasLastSeed {
				recommendedAction = "preserve"
			} else {
				recommendedAction = "keep_best"
			}
		} else if hasLastSeed {
			groupType = "last_seed"
			recommendedAction = "preserve"
		} else if duplicateHashSet[torrent.Hash] {
			groupType = "duplicate"
			recommendedAction = "keep_best"
		}

		// Calculate sizes and savings
		var totalSize int64
		for _, t := range groupTorrents {
			totalSize += t.Size
		}

		deduplicatedSize := groupTorrents[0].Size // Size of the best (first) torrent
		potentialSavings := totalSize - deduplicatedSize
		if potentialSavings < 0 {
			potentialSavings = 0
		}

		// Create the enhanced group
		enhancedGroup := TorrentGroup{
			ID:                fmt.Sprintf("group_%d", groupID),
			Torrents:          groupTorrents,
			PrimaryTorrent:    groupTorrents[0], // Best torrent is first after sorting
			GroupType:         groupType,
			TotalSize:         totalSize,
			DeduplicatedSize:  deduplicatedSize,
			PotentialSavings:  potentialSavings,
			RecommendedAction: recommendedAction,
			Priority:          int(groupTorrents[0].ReviewPriority), // Use best torrent's priority
		}

		enhancedGroups = append(enhancedGroups, enhancedGroup)
		groupID++
	}

	// Sort groups by priority (lowest priority value = highest urgency)
	sort.Slice(enhancedGroups, func(i, j int) bool {
		// Last seed groups get highest priority
		if enhancedGroups[i].GroupType == "last_seed" && enhancedGroups[j].GroupType != "last_seed" {
			return true
		}
		if enhancedGroups[i].GroupType != "last_seed" && enhancedGroups[j].GroupType == "last_seed" {
			return false
		}
		// Then by review priority
		return enhancedGroups[i].Priority < enhancedGroups[j].Priority
	})

	// Update priority numbers to be sequential
	for i := range enhancedGroups {
		enhancedGroups[i].Priority = i + 1
	}

	return enhancedGroups
}

// CreatePaginatedReviewTorrents creates paginated review torrents with groups
func (es *EconomyService) CreatePaginatedReviewTorrents(reviewTorrents []EconomyScore, allGroups [][]EconomyScore, allEnhancedGroups []TorrentGroup, page, pageSize int) PaginatedReviewTorrents {
	totalItems := len(reviewTorrents)
	totalPages := (totalItems + pageSize - 1) / pageSize

	// Ensure page is within bounds
	if page < 1 {
		page = 1
	}
	if page > totalPages && totalPages > 0 {
		page = totalPages
	}

	// Calculate start and end indices
	startIndex := (page - 1) * pageSize
	endIndex := startIndex + pageSize
	if endIndex > totalItems {
		endIndex = totalItems
	}

	// Get the torrents for this page
	pageTorrents := reviewTorrents[startIndex:endIndex]

	// Create legacy groups for the current page torrents
	pageGroups := es.createGroupsForPage(pageTorrents, allGroups)

	// Create enhanced groups for the current page
	pageEnhancedGroups := es.createEnhancedGroupsForPage(pageTorrents, allEnhancedGroups)

	return PaginatedReviewTorrents{
		Torrents:        pageTorrents,
		Groups:          pageGroups,
		TorrentGroups:   pageEnhancedGroups,
		GroupingEnabled: len(pageEnhancedGroups) > 0,
		Pagination: PaginationInfo{
			Page:        page,
			PageSize:    pageSize,
			TotalItems:  totalItems,
			TotalPages:  totalPages,
			HasNextPage: page < totalPages,
			HasPrevPage: page > 1,
		},
	}
}

// createGroupsForPage creates groups for the torrents on the current page
func (es *EconomyService) createGroupsForPage(pageTorrents []EconomyScore, allGroups [][]EconomyScore) [][]EconomyScore {
	var pageGroups [][]EconomyScore
	torrentHashesOnPage := make(map[string]bool)

	// Create a map of hashes on this page
	for _, torrent := range pageTorrents {
		torrentHashesOnPage[torrent.Hash] = true
	}

	// Find complete groups that have members on this page
	for _, group := range allGroups {
		// Check if this group has any members on the current page
		hasMembersOnPage := false
		for _, torrent := range group {
			if torrentHashesOnPage[torrent.Hash] {
				hasMembersOnPage = true
				break
			}
		}

		// If the group has members on this page, include the complete group
		// This ensures groups are shown in full even if some members are on other pages
		if hasMembersOnPage {
			pageGroups = append(pageGroups, group)
		}
	}

	return pageGroups
}

// createEnhancedGroupsForPage creates enhanced groups for the torrents on the current page
func (es *EconomyService) createEnhancedGroupsForPage(pageTorrents []EconomyScore, allEnhancedGroups []TorrentGroup) []TorrentGroup {
	var pageEnhancedGroups []TorrentGroup
	torrentHashesOnPage := make(map[string]bool)

	// Create a map of hashes on this page
	for _, torrent := range pageTorrents {
		torrentHashesOnPage[torrent.Hash] = true
	}

	// Find complete enhanced groups that have members on this page
	for _, group := range allEnhancedGroups {
		// Check if this group has any members on the current page
		hasMembersOnPage := false
		for _, torrent := range group.Torrents {
			if torrentHashesOnPage[torrent.Hash] {
				hasMembersOnPage = true
				break
			}
		}

		// If the group has members on this page, include the complete group
		// This ensures groups are shown in full even if some members are on other pages
		if hasMembersOnPage {
			pageEnhancedGroups = append(pageEnhancedGroups, group)
		}
	}

	return pageEnhancedGroups
}
