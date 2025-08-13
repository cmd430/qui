#!/bin/bash

set -euo pipefail

COPYRIGHT_HOLDER="s0up and the autobrr contributors"
COPYRIGHT_YEAR="2025"
LICENSE="GPL-2.0"

TS_HEADER="/*
 * Copyright (c) ${COPYRIGHT_YEAR}, ${COPYRIGHT_HOLDER}.
 * SPDX-License-Identifier: ${LICENSE}
 */"

GO_HEADER="// Copyright (c) ${COPYRIGHT_YEAR}, ${COPYRIGHT_HOLDER}.
// SPDX-License-Identifier: ${LICENSE}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Counters
updated=0
skipped=0

echo -e "${GREEN}Updating license headers to ${LICENSE}${NC}"
echo ""

# Function to check if file has correct header
has_correct_header() {
    local file="$1"
    local expected="$2"
    local lines_to_check="$3"
    
    # Get first N lines of file
    local actual=$(head -n "$lines_to_check" "$file" 2>/dev/null || echo "")
    
    # Compare with expected header
    [[ "$actual" == "$expected" ]]
}

# Function to update file header
update_header() {
    local file="$1"
    local header="$2"
    local temp_file=$(mktemp)
    
    # Write new header
    echo "$header" > "$temp_file"
    echo "" >> "$temp_file"
    
    # Skip old header if it exists (any comment block at start)
    local in_comment=0
    local past_header=0
    
    while IFS= read -r line; do
        # For block comments
        if [[ $past_header -eq 0 ]]; then
            if [[ "$line" =~ ^/\* ]]; then
                in_comment=1
                continue
            elif [[ $in_comment -eq 1 && "$line" =~ \*/ ]]; then
                in_comment=0
                past_header=1
                continue
            elif [[ $in_comment -eq 1 ]]; then
                continue
            fi
            
            # For line comments at start
            if [[ "$line" =~ ^//.*[Cc]opyright ]] || [[ "$line" =~ ^//.*SPDX-License-Identifier ]]; then
                continue
            fi
            
            # Empty lines after header
            if [[ $past_header -eq 0 && -z "$line" ]]; then
                continue
            fi
            
            # First non-header line found
            past_header=1
        fi
        
        echo "$line" >> "$temp_file"
    done < "$file"
    
    mv "$temp_file" "$file"
}

# Process TypeScript/TSX files
echo -e "${YELLOW}Processing TypeScript/TSX files...${NC}"
while IFS= read -r -d '' file; do
    if has_correct_header "$file" "$TS_HEADER" 4; then
        ((skipped++))
    else
        update_header "$file" "$TS_HEADER"
        echo -e "  ${GREEN}✓${NC} $file"
        ((updated++))
    fi
done < <(find . -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/build/*" -print0)

echo ""

# Process Go files
echo -e "${YELLOW}Processing Go files...${NC}"
while IFS= read -r -d '' file; do
    if has_correct_header "$file" "$GO_HEADER" 2; then
        ((skipped++))
    else
        update_header "$file" "$GO_HEADER"
        echo -e "  ${GREEN}✓${NC} $file"
        ((updated++))
    fi
done < <(find . -type f -name "*.go" -not -path "*/vendor/*" -not -path "*/.git/*" -print0)

echo ""
echo -e "${GREEN}=== Summary ===${NC}"
echo -e "Files updated: ${GREEN}$updated${NC}"
echo -e "Files already correct: $skipped"

if [ $updated -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}Don't forget to review and commit the changes!${NC}"
fi