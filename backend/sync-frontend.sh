#!/bin/bash
# Sync frontend files from primary to bundled location for BTP deployments
# This should be run after any frontend changes

SOURCE="/app/frontend/public"
TARGET="/app/backend/app"

echo "🔄 Syncing frontend files..."
echo "   Source: $SOURCE"
echo "   Target: $TARGET"

if [ ! -d "$SOURCE" ]; then
    echo "❌ Source directory does not exist: $SOURCE"
    exit 1
fi

# Create target directory if it doesn't exist
mkdir -p "$TARGET"

# Sync files (excluding node_modules and hidden files)
rsync -av --delete \
    --exclude 'node_modules' \
    --exclude '.*' \
    "$SOURCE/" "$TARGET/"

echo "✅ Frontend sync complete!"
echo "   Files synced to: $TARGET"
