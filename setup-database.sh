#!/bin/bash

# 🗃️ MongoDB Setup Options for SmartAttend

echo "🗃️ MongoDB Setup for SmartAttend"
echo "================================"

echo ""
echo "Choose your MongoDB setup option:"
echo ""
echo "1️⃣  Local MongoDB Installation"
echo "2️⃣  MongoDB Atlas (Cloud - Recommended)"
echo "3️⃣  Docker MongoDB (Quick Setup)"
echo ""

read -p "Select option (1-3): " choice

case $choice in
    1)
        echo ""
        echo "🔧 Setting up Local MongoDB..."
        echo ""
        echo "Installing MongoDB locally:"
        echo "sudo apt update"
        echo "sudo apt install -y mongodb"
        echo ""
        echo "Starting MongoDB service:"
        echo "sudo systemctl start mongodb"
        echo "sudo systemctl enable mongodb"
        echo ""
        echo "Your connection string will be:"
        echo "MONGODB_URI=mongodb://localhost:27017/smartattend"
        echo ""
        echo "Run these commands manually:"
        echo "sudo apt update && sudo apt install -y mongodb"
        echo "sudo systemctl start mongodb"
        ;;
        
    2)
        echo ""
        echo "☁️  Setting up MongoDB Atlas (Cloud)..."
        echo ""
        echo "Follow these steps:"
        echo ""
        echo "1. Go to https://www.mongodb.com/atlas"
        echo "2. Create a free account"
        echo "3. Create a new cluster (free tier)"
        echo "4. Create a database user:"
        echo "   - Username: smartattend_user"
        echo "   - Password: [generate secure password]"
        echo "5. Whitelist your IP address (0.0.0.0/0 for development)"
        echo "6. Get your connection string"
        echo "7. Update .env file with:"
        echo "   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/smartattend"
        echo ""
        echo "🌐 Opening MongoDB Atlas in browser..."
        if command -v xdg-open > /dev/null; then
            xdg-open "https://www.mongodb.com/atlas" 2>/dev/null &
        fi
        ;;
        
    3)
        echo ""
        echo "🐳 Setting up Docker MongoDB..."
        echo ""
        if command -v docker >/dev/null 2>&1; then
            echo "Starting MongoDB container..."
            docker run -d \
                --name smartattend-mongo \
                -p 27017:27017 \
                -e MONGO_INITDB_ROOT_USERNAME=admin \
                -e MONGO_INITDB_ROOT_PASSWORD=smartattend123 \
                -e MONGO_INITDB_DATABASE=smartattend \
                mongo:latest
            
            echo ""
            echo "✅ MongoDB container started!"
            echo ""
            echo "Connection details:"
            echo "MONGODB_URI=mongodb://admin:smartattend123@localhost:27017/smartattend?authSource=admin"
            echo ""
            echo "To stop: docker stop smartattend-mongo"
            echo "To start: docker start smartattend-mongo"
            echo "To remove: docker rm smartattend-mongo"
        else
            echo "❌ Docker not found. Please install Docker first:"
            echo "sudo apt update"
            echo "sudo apt install docker.io"
            echo "sudo systemctl start docker"
            echo "sudo usermod -aG docker $USER"
            echo ""
            echo "Then run this script again."
        fi
        ;;
        
    *)
        echo "❌ Invalid option. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "📝 Don't forget to update your .env file with the correct MONGODB_URI!"
