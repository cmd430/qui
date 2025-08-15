// Copyright (c) 2025, s0up and the autobrr contributors.
// SPDX-License-Identifier: GPL-2.0-or-later

package database

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMigrationIdempotency(t *testing.T) {
	// Count actual migration files
	migrationsDir := filepath.Join("migrations")
	entries, err := os.ReadDir(migrationsDir)
	require.NoError(t, err, "Failed to read migrations directory")
	
	expectedMigrations := 0
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".sql") {
			expectedMigrations++
		}
	}
	
	// Create temp directory for test database
	tmpDir, err := os.MkdirTemp("", "qui-test-idempotent-*")
	require.NoError(t, err)
	defer os.RemoveAll(tmpDir)

	dbPath := filepath.Join(tmpDir, "test.db")

	// Initialize database first time
	db1, err := New(dbPath)
	require.NoError(t, err, "Failed to initialize database first time")
	
	// Count migrations applied
	var count1 int
	err = db1.conn.QueryRow("SELECT COUNT(*) FROM migrations").Scan(&count1)
	require.NoError(t, err, "Failed to count migrations")
	db1.Close()

	// Initialize database second time (should be idempotent)
	db2, err := New(dbPath)
	require.NoError(t, err, "Failed to initialize database second time")
	defer db2.Close()

	// Count migrations applied again
	var count2 int
	err = db2.conn.QueryRow("SELECT COUNT(*) FROM migrations").Scan(&count2)
	require.NoError(t, err, "Failed to count migrations")

	assert.Equal(t, count1, count2, "Migration count should be the same after re-initialization")
	assert.Equal(t, expectedMigrations, count2, "Applied migrations should match the number of .sql files in migrations directory")
}

