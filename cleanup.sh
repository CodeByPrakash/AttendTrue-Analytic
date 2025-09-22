#!/bin/bash

# SmartAttend Project Cleanup Script
echo "🧹 Starting SmartAttend project cleanup..."

# Navigate to project root
cd /home/swaraj-satapathy/Desktop/attendance-analytic-system

# Create docs directory for documentation
echo "📁 Creating docs directory..."
mkdir -p docs

# Move documentation files to docs folder
echo "📄 Moving documentation files..."
mv "full detailes.txt" docs/ 2>/dev/null
mv "Full Report.docx" docs/ 2>/dev/null
mv "prompt.docx" docs/ 2>/dev/null
mv "Sih Attendance Prompt.pdf" docs/ 2>/dev/null

# Navigate to smartattend directory
cd smartattend

# Remove Next.js build cache
echo "🗑️  Removing .next build cache..."
rm -rf .next

# Remove .env.example (keeping only .env)
echo "🔧 Cleaning up environment files..."
rm -f .env.example

# Create proper .gitignore
echo "📝 Updating .gitignore..."
cat > .gitignore << EOF
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Next.js
.next/
out/
build/

# Production builds
dist/

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Logs
logs
*.log

# Temporary files
*.tmp
*.temp

# Database
*.db
*.sqlite

# Uploaded files (if any)
uploads/
EOF

echo "✅ Cleanup completed!"
echo ""
echo "📊 Space saved breakdown:"
echo "- Removed .next build cache"
echo "- Organized documentation files in docs/"
echo "- Updated .gitignore for better file management"
echo ""
echo "💡 Optional cleanup (run manually if needed):"
echo "- Remove virtual environment: rm -rf ../.venv"
echo "- Clear npm cache: npm cache clean --force"
echo ""
echo "🚀 Your project is now cleaner and better organized!"
