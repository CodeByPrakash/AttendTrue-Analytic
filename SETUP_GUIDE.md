# 🔧 SmartAttend Environment Setup Guide

## 📋 **Prerequisites Setup**

### 1. Install Node.js and npm (if not already installed)
```bash
# Check if Node.js is installed
node --version
npm --version

# If not installed, install Node.js 18+ from https://nodejs.org/
```

### 2. Install MongoDB (Local Database)
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y mongodb

# Start MongoDB service
sudo systemctl start mongodb
sudo systemctl enable mongodb

# Verify MongoDB is running
sudo systemctl status mongodb
```

### 3. Install Git (if not already installed)
```bash
sudo apt install git
```

## 🔑 **Environment Variables Setup**

### Step 1: Basic Configuration
The `.env` file is already created. You need to update the following values:

#### **Database Configuration:**
```env
# Replace with your actual MongoDB connection
MONGODB_URI=mongodb://localhost:27017/smartattend

# If using MongoDB Atlas (cloud), replace with:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/smartattend
```

#### **Authentication Secrets:**
```env
# Generate a secure secret for NextAuth (use a random 32+ character string)
NEXTAUTH_SECRET=your-super-secure-secret-key-at-least-32-characters-long

# Generate a secure JWT secret
JWT_SECRET=another-secure-jwt-secret-key-32-characters
```

### Step 2: Clerk Authentication Setup (Optional but Recommended)

#### **Get Clerk Keys:**
1. Go to https://clerk.com/ and create an account
2. Create a new application
3. Go to "API Keys" section
4. Copy your keys and update .env:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your-actual-publishable-key-here
CLERK_SECRET_KEY=sk_test_your-actual-secret-key-here
```

### Step 3: Email Configuration (Optional)
For sending notifications:

```env
# Gmail SMTP (you need to generate an app password)
EMAIL_SERVER_USER=your-email@gmail.com
EMAIL_SERVER_PASSWORD=your-gmail-app-password
```

## 🗃️ **Database Setup**

### Option 1: Local MongoDB
```bash
# Start MongoDB
sudo systemctl start mongodb

# Create database and user (optional)
mongo
> use smartattend
> db.createUser({
    user: "smartattend_user",
    pwd: "secure_password",
    roles: ["readWrite"]
})
> exit
```

### Option 2: MongoDB Atlas (Cloud - Recommended)
1. Go to https://www.mongodb.com/atlas
2. Create a free cluster
3. Create a database user
4. Whitelist your IP address
5. Get the connection string
6. Update MONGODB_URI in .env

## 🚀 **Application Startup**

### Step 1: Install Dependencies
```bash
cd smartattend
npm install --legacy-peer-deps
```

### Step 2: Set Up Environment
```bash
# Copy and edit environment variables
cp .env .env.local
# Edit .env with your actual values
```

### Step 3: Start Development Server
```bash
npm run dev
```

### Step 4: Access the Application
- **Local URL:** http://localhost:3000
- **Network URL:** Check terminal output for network IP

## 🔧 **Production Deployment**

### Build for Production
```bash
npm run build
npm start
```

### Environment for Production
Create `.env.production` with production values:
- Use secure secrets
- Production database URL
- Production Clerk keys
- Remove debug flags

## 🛠️ **Troubleshooting**

### Common Issues:

#### 1. MongoDB Connection Error
```bash
# Check if MongoDB is running
sudo systemctl status mongodb

# Restart MongoDB
sudo systemctl restart mongodb
```

#### 2. Clerk Authentication Error
- Verify your Clerk keys are correct
- Check if domain is added to Clerk dashboard
- Ensure keys match the environment (development/production)

#### 3. Port Already in Use
```bash
# Kill process using port 3000
sudo lsof -ti:3000 | xargs kill -9

# Or use different port
npm run dev -- -p 3001
```

#### 4. Package Installation Issues
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

## 📱 **Feature Configuration**

### Enable Face Recognition
- Models are already included in `public/models/`
- Ensure camera permissions are granted
- Test in HTTPS environment for production

### Enable PWA Features
- Service worker is configured
- Test offline functionality
- Install app from browser

### Configure Real-time Features
- WebSocket server starts automatically
- Check firewall settings for production
- Configure CORS for external domains

## 🔒 **Security Checklist**

### Development
- [x] .env file in .gitignore
- [x] Secure secret keys
- [x] Database authentication

### Production
- [ ] HTTPS enabled
- [ ] Secure headers configured
- [ ] Rate limiting enabled
- [ ] Input validation
- [ ] CORS properly configured

## 📞 **Support**

If you encounter issues:
1. Check the console for error messages
2. Verify all environment variables
3. Ensure all services are running
4. Check network connectivity
5. Review the troubleshooting section
