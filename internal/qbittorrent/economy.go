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
	Age                 int64    `json:"age"` // Age in days
	EconomyScore        float64  `json:"economyScore"`
	StorageValue        float64  `json:"storageValue"`
	RarityBonus         float64  `json:"rarityBonus"`
	DeduplicationFactor float64  `json:"deduplicationFactor"`
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

// EconomyAnalysis represents the complete economy analysis
type EconomyAnalysis struct {
	Scores              []EconomyScore            `json:"scores"`
	Stats               EconomyStats              `json:"stats"`
	TopValuable         []EconomyScore            `json:"topValuable"`
	Duplicates          map[string][]string       `json:"duplicates"` // Map of content hash to torrent hashes
	Optimizations       []OptimizationOpportunity `json:"optimizations"`
	StorageOptimization StorageOptimization       `json:"storageOptimization"`
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

	// Sort by economy score (highest first)
	sort.Slice(scores, func(i, j int) bool {
		return scores[i].EconomyScore > scores[j].EconomyScore
	})

	// Calculate statistics
	stats := es.calculateStats(scores, duplicates)

	// Calculate optimization opportunities
	optimizations := es.calculateOptimizationOpportunities(scores, duplicates)

	// Calculate storage optimization data
	storageOptimization := es.calculateStorageOptimization(scores, duplicates)

	// Get top valuable torrents
	topValuable := scores
	if len(topValuable) > 20 {
		topValuable = topValuable[:20]
	}

	return &EconomyAnalysis{
		Scores:              scores,
		Stats:               stats,
		TopValuable:         topValuable,
		Duplicates:          duplicates,
		Optimizations:       optimizations,
		StorageOptimization: storageOptimization,
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

	// Base storage value (size in GB)
	storageValue := float64(torrent.Size) / (1024 * 1024 * 1024)

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

	// Age penalty for well-seeded content (old, well-seeded content is less valuable)
	agePenalty := 1.0
	if torrent.NumSeeds > 10 && ageInDays > 30 {
		// Exponential penalty for old, well-seeded content
		agePenalty = math.Max(0.1, math.Pow(0.95, float64(ageInDays-30)))
	}

	// Size bonus (larger files are more valuable to store)
	sizeBonus := 1.0
	if storageValue > 10 {
		sizeBonus = 1.5 // Large files
	} else if storageValue > 1 {
		sizeBonus = 1.2 // Medium files
	}

	// Ratio consideration (completed downloads are more valuable)
	ratioBonus := 1.0
	if torrent.Ratio > 1.0 {
		ratioBonus = 1.1
	} else if torrent.Ratio < 0.5 {
		ratioBonus = 0.9
	}

	// Calculate final economy score
	economyScore := storageValue * rarityBonus * agePenalty * sizeBonus * ratioBonus

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
		DeduplicationFactor: 1.0, // Will be updated later
		Tracker:             torrent.Tracker,
		State:               string(torrent.State),
		Category:            torrent.Category,
		LastActivity:        torrent.LastActivity,
	}
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

	for primaryHash, duplicateHashes := range duplicates {
		primaryScore, exists := scoreMap[primaryHash]
		if !exists {
			continue
		}

		// Find the most valuable copy in this duplicate group
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

		// Keep the best copy with full value, set others to 0
		for _, hash := range allHashes {
			if score := scoreMap[hash]; score != nil {
				if hash == bestHash {
					// Best copy retains full value
					score.DeduplicationFactor = 1.0
					score.Duplicates = make([]string, 0)
					for _, h := range allHashes {
						if h != bestHash {
							score.Duplicates = append(score.Duplicates, h)
						}
					}
				} else {
					// Other copies get zero value (free storage)
					score.DeduplicationFactor = 0.0
					score.EconomyScore = 0.0
				}
			}
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

		if score.EconomyScore > 5.0 {
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

	// 2. Old well-seeded content cleanup - only for single torrents (no duplicates)
	var oldWellSeededHashes []string
	var oldWellSeededSize int64

	// Create set of all duplicate hashes for quick lookup
	duplicateHashSet := make(map[string]bool)
	for _, dupHashes := range duplicates {
		for _, hash := range dupHashes {
			duplicateHashSet[hash] = true
		}
	}

	for _, score := range scores {
		// Only consider torrents that are NOT duplicates (single copies)
		if !duplicateHashSet[score.Hash] && score.Seeds > 10 && score.Age > 90 && score.EconomyScore < 2.0 {
			oldWellSeededHashes = append(oldWellSeededHashes, score.Hash)
			oldWellSeededSize += score.Size
		}
	}

	if len(oldWellSeededHashes) > 0 {
		savings := int64(float64(oldWellSeededSize) * 0.8) // Assume 80% can be cleaned up
		opportunities = append(opportunities, OptimizationOpportunity{
			Type:        "old_content_cleanup",
			Title:       "Clean Up Old Well-Seeded Content",
			Description: fmt.Sprintf("Remove %d old, well-seeded torrents that are no longer providing value", len(oldWellSeededHashes)),
			Priority:    "medium",
			Savings:     savings,
			Impact:      65.0,
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

	// 5. High-value content preservation
	var highValueHashes []string
	var highValueSize int64

	for _, score := range scores {
		if score.EconomyScore > 8.0 && score.Seeds < 5 { // High value, rare content
			highValueHashes = append(highValueHashes, score.Hash)
			highValueSize += score.Size
		}
	}

	if len(highValueHashes) > 0 {
		opportunities = append(opportunities, OptimizationOpportunity{
			Type:        "preserve_rare_content",
			Title:       "Preserve Rare High-Value Content",
			Description: fmt.Sprintf("Ensure %d rare, high-value torrents are properly seeded and backed up", len(highValueHashes)),
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

	// Calculate old content cleanup savings - only for single torrents (no duplicates)
	duplicateHashSet := make(map[string]bool)
	for _, dupHashes := range duplicates {
		for _, hash := range dupHashes {
			duplicateHashSet[hash] = true
		}
	}

	for _, score := range scores {
		// Only consider torrents that are NOT duplicates (single copies)
		if !duplicateHashSet[score.Hash] && score.Seeds > 10 && score.Age > 90 && score.EconomyScore < 2.0 {
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
