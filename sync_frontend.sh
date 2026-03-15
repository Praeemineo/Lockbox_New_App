#!/bin/bash

# Sync Frontend Files to Backend Deployment Folder
# This ensures both locations have the same code

echo "=========================================="
echo "Syncing Frontend to Backend Deployment"
echo "=========================================="

# Sync view files
echo "📁 Syncing view files..."
cp /app/frontend/public/webapp/view/*.xml /app/backend/app/webapp/view/
echo "✅ View files synced"

# Sync controller files
echo "📁 Syncing controller files..."
cp /app/frontend/public/webapp/controller/*.js /app/backend/app/webapp/controller/
echo "✅ Controller files synced"

# Remove preload files to force regeneration
echo "🗑️  Removing preload files..."
rm -f /app/frontend/public/webapp/Component-preload.js
rm -f /app/backend/app/webapp/Component-preload.js
echo "✅ Preload files removed"

# Restart services
echo "🔄 Restarting services..."
sudo supervisorctl restart backend frontend
sleep 3
sudo supervisorctl status | grep -E "backend|frontend"

echo ""
echo "=========================================="
echo "✅ Sync Complete!"
echo "=========================================="
echo "Note: Clear browser cache with Ctrl+F5"
echo "=========================================="
