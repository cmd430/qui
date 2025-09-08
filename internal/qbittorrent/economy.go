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
	Hash                string    `json:"hash"`
	Name                string    `json:"name"`
	Size                int64     `json:"size"`
	Seeds               int       `json:"seeds"`
	Peers               int       `json:"peers"`
	Ratio               float64   `json:"ratio"`
	Age                 int64     `json:"age"` // Age in days
	EconomyScore        float64   `json:"economyScore"`
	StorageValue        float64   `json:"storageValue"`
	RarityBonus         float64   `json:"rarityBonus"`
	DeduplicationFactor float64   `json:"deduplicationFactor"`
	Duplicates          []string  `json:"duplicates,omitempty"` // Hash of duplicate torrents
	Tracker             string    `json:"tracker"`
	State               string    `json:"state"`
	Category            string    `json:"category"`
}

// EconomyStats represents aggregated economy statistics
type EconomyStats struct {
	TotalTorrents         int     `json:"totalTorrents"`
	TotalStorage          int64   `json:"totalStorage"`
	DeduplicatedStorage   int64   `json:"deduplicatedStorage"`
	StorageSavings        int64   `json:"storageSavings"`
	AverageEconomyScore   float64 `json:"averageEconomyScore"`
	HighValueTorrents     int     `json:"highValueTorrents"`
	RareContentCount      int     `json:"rareContentCount"`
	WellSeededOldContent  int     `json:"wellSeededOldContent"`
}

// EconomyAnalysis represents the complete economy analysis
type EconomyAnalysis struct {
	Scores      []EconomyScore `json:"scores"`
	Stats       EconomyStats   `json:"stats"`
	TopValuable []EconomyScore `json:"topValuable"`
	Duplicates  map[string][]string `json:"duplicates"` // Map of content hash to torrent hashes
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
			Scores:      []EconomyScore{},
			Stats:       EconomyStats{},
			TopValuable: []EconomyScore{},
			Duplicates:  make(map[string][]string),
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

	// Get top valuable torrents
	topValuable := scores
	if len(topValuable) > 20 {
		topValuable = topValuable[:20]
	}

	return &EconomyAnalysis{
		Scores:      scores,
		Stats:       stats,
		TopValuable: topValuable,
		Duplicates:  duplicates,
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

		// Calculate deduplication factor
		// More duplicates = lower value per copy (but first copy retains full value)
		totalCopies := len(duplicateHashes) + 1
		dedupFactor := 1.0 / math.Sqrt(float64(totalCopies))

		primaryScore.DeduplicationFactor = dedupFactor
		primaryScore.EconomyScore *= dedupFactor

		// Add duplicate hashes to primary
		primaryScore.Duplicates = duplicateHashes

		// Update duplicate scores
		for _, dupHash := range duplicateHashes {
			if dupScore, exists := scoreMap[dupHash]; exists {
				dupScore.DeduplicationFactor = dedupFactor
				dupScore.EconomyScore *= dedupFactor
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

	for _, score := range scores {
		totalStorage += score.Size

		// For deduplicated storage, only count the primary copy fully
		if len(score.Duplicates) == 0 {
			deduplicatedStorage += score.Size
		} else {
			// For duplicates, count only a fraction
			deduplicatedStorage += int64(float64(score.Size) / float64(len(score.Duplicates)+1))
		}

		totalEconomyScore += score.EconomyScore

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
