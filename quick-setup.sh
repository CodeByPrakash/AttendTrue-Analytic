#!/bin/bash

# 🚀 SmartAttend Quick Setup Script
echo "🎯 SmartAttend Quick Setup Starting..."
echo "============================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "smartattend/package.json" ]; then
    print_error "Please run this script from the attendance-analytic-system directory"
    exit 1
fi

# Step 1: Check prerequisites
echo "🔍 Checking prerequisites..."

# Check Node.js
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    print_status "Node.js found: $NODE_VERSION"
else
    print_error "Node.js not found. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

# Check npm
if command -v npm >/dev/null 2>&1; then
    NPM_VERSION=$(npm --version)
    print_status "npm found: $NPM_VERSION"
else
    print_error "npm not found. Please install npm"
    exit 1
fi

# Check MongoDB
if command -v mongod >/dev/null 2>&1; then
    print_status "MongoDB found"
else
    print_warning "MongoDB not found locally. You can:"
    echo "  1. Install MongoDB locally: sudo apt install mongodb"
    echo "  2. Use MongoDB Atlas (cloud) - recommended"
    echo "  3. Use Docker: docker run -d -p 27017:27017 mongo"
fi

# Step 2: Navigate to smartattend directory
cd smartattend

# Step 3: Install dependencies
echo ""
echo "📦 Installing dependencies..."
if npm install --legacy-peer-deps; then
    print_status "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Step 4: Environment setup
echo ""
echo "🔧 Setting up environment..."

# Check if .env exists and has placeholder values
if [ -f ".env" ]; then
    if grep -q "your-nextauth-secret-key-here" .env; then
        print_warning "Environment file contains placeholder values"
        echo ""
        echo "🔑 IMPORTANT: Update your .env file with actual values:"
        echo ""
        echo "1. NEXTAUTH_SECRET - Generate a secure 32+ character secret"
        echo "2. MONGODB_URI - Your MongoDB connection string"
        echo "3. JWT_SECRET - Another secure secret for JWT tokens"
        echo "4. CLERK_PUBLISHABLE_KEY - Get from https://clerk.com (optional)"
        echo "5. CLERK_SECRET_KEY - Get from https://clerk.com (optional)"
        echo ""
        
        # Offer to generate secrets
        read -p "🤖 Generate secure secrets automatically? (y/n): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Generate secure secrets
            NEXTAUTH_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
            JWT_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
            
            # Update .env file
            sed -i "s/your-nextauth-secret-key-here-change-this-in-production/$NEXTAUTH_SECRET/" .env
            sed -i "s/your-jwt-secret-key-for-tokens-change-in-production/$JWT_SECRET/" .env
            
            print_status "Secure secrets generated and updated in .env"
        fi
    else
        print_status "Environment file looks configured"
    fi
else
    print_error ".env file not found"
    exit 1
fi

# Step 5: Database setup suggestions
echo ""
echo "🗃️  Database Setup Options:"
echo ""
echo "Option 1 - Local MongoDB:"
echo "  sudo systemctl start mongodb"
echo "  # Use: mongodb://localhost:27017/smartattend"
echo ""
echo "Option 2 - MongoDB Atlas (Recommended):"
echo "  1. Go to https://www.mongodb.com/atlas"
echo "  2. Create free cluster"
echo "  3. Get connection string"
echo "  4. Update MONGODB_URI in .env"
echo ""
echo "Option 3 - Docker MongoDB:"
echo "  docker run -d -p 27017:27017 --name mongodb mongo"
echo ""

# Step 6: Start development server
echo ""
read -p "🚀 Start the development server now? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🌟 Starting SmartAttend development server..."
    echo "============================================"
    echo ""
    print_info "The application will be available at:"
    echo "   📱 Local:    http://localhost:3000"
    echo "   🌐 Network:  http://YOUR_IP:3000"
    echo ""
    print_info "To stop the server, press Ctrl+C"
    echo ""
    
    # Start the development server
    npm run dev
else
    echo ""
    print_info "Setup completed! To start the server later, run:"
    echo "   cd smartattend"
    echo "   npm run dev"
fi

echo ""
print_status "Setup completed successfully! 🎉"
echo ""
echo "📚 Next steps:"
echo "1. Update .env with your actual database connection"
echo "2. Configure Clerk authentication (optional)"
echo "3. Set up email service (optional)"
echo "4. Review SETUP_GUIDE.md for detailed configuration"
echo ""
echo "🔗 Useful links:"
echo "   • MongoDB Atlas: https://www.mongodb.com/atlas"
echo "   • Clerk Auth: https://clerk.com"
echo "   • Project Documentation: ./docs/"
echo ""
print_status "Happy coding! 🚀"
