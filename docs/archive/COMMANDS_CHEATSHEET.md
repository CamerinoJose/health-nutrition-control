# Git & Render Commands Cheat Sheet

Quick reference for all commands you'll need.

---

## Git Commands

### Initial Setup
```bash
# Navigate to your project
cd c:\Users\camer\github

# Initialize git
git init

# Set your identity
git config user.name "Your Name"
git config user.email "your@email.com"
```

### Committing Code
```bash
# Check status of files
git status

# Add all files
git add .

# Add specific file
git add frontend/src/App.jsx

# Commit with message
git commit -m "Your message here"

# Check commit history
git log --oneline
```

### Pushing to GitHub
```bash
# First time: add remote
git remote add origin https://github.com/USERNAME/bienestarapp.git

# Set default branch
git branch -M main

# Push to GitHub
git push -u origin main

# Future pushes
git push
```

### Undo Changes
```bash
# Undo unstaged changes
git checkout -- filename.js

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1
```

---

## Render Deployment Commands

### Backend Build & Run (Local Testing)
```bash
# Navigate to backend
cd c:\Users\camer\github\backend

# Install dependencies
go mod download

# Build
go build -o app .

# Run locally
./app

# Or with PORT env var
$env:PORT="8080"
./app
```

### Environment Variables (Render)

Set these in Render dashboard:

```
PORT=8080
JWT_SECRET=your_secret_key_here
GIN_MODE=release
```

### Database (PostgreSQL optional)
```bash
# If you decide to add PostgreSQL later
# Render will provide connection string
# Format: postgresql://user:password@host:port/database
```

---

## APK Build Commands

### Rebuild APK with New Backend URL

```bash
# Navigate to mobile
cd c:\Users\camer\github\mobile\android

# Clean previous build
./gradlew.bat clean

# Build debug APK
./gradlew.bat assembleDebug

# APK location
# mobile/android/app/build/outputs/apk/debug/app-debug.apk

# For release (signed)
./gradlew.bat assembleRelease
```

### Check APK Build Output
```bash
# List APK files
dir app\build\outputs\apk\debug\

# Check file size
ls -lh app/build/outputs/apk/debug/app-debug.apk
```

---

## Frontend Build Commands (Vercel)

### Local Testing
```bash
# Navigate to frontend
cd c:\Users\camer\github\frontend

# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview build
npm run preview
```

### Deploy to Vercel
```bash
# Install Vercel CLI (optional)
npm i -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod
```

---

## Useful Git Workflows

### Push New Changes to GitHub
```bash
# After you make code changes:
git add .
git commit -m "Your change description"
git push

# Render auto-deploys!
```

### Check Remote URL
```bash
git remote -v
```

### Update Remote URL
```bash
# If you need to change GitHub URL
git remote set-url origin https://github.com/USERNAME/bienestarapp.git
```

### Sync with GitHub
```bash
# Pull latest changes
git pull

# Fetch without merging
git fetch
```

---

## Common Scenarios

### Scenario 1: You made changes, want to push to GitHub

```bash
cd c:\Users\camer\github
git add .
git commit -m "Description of changes"
git push
```

Then Render auto-deploys! (5-10 minutes)

### Scenario 2: You changed the APK, want to rebuild

```bash
cd c:\Users\camer\github\mobile\android
./gradlew.bat clean
./gradlew.bat assembleDebug
# APK is ready at: app\build\outputs\apk\debug\app-debug.apk
```

### Scenario 3: You want to check Git history

```bash
cd c:\Users\camer\github
git log --oneline --graph --all
```

### Scenario 4: You made a mistake, want to undo

```bash
# If not committed yet
git checkout -- filename.js

# If already committed
git revert HEAD

# Or reset to previous commit
git reset --hard HEAD~1
```

---

## Troubleshooting Commands

### Check if Git is installed
```bash
git --version
```

### Check if Go is installed
```bash
go version
```

### Check if Node is installed
```bash
node --version
npm --version
```

### Check Java version (for Android)
```bash
java -version
```

### Check Gradle version
```bash
cd c:\Users\camer\github\mobile\android
./gradlew.bat --version
```

### Check file permissions (if issues)
```bash
# On Windows, this usually doesn't matter
# On Mac/Linux:
chmod +x gradlew
chmod +x app.exe
```

---

## Environment Variables Setup

### On Windows PowerShell
```bash
# Temporary (current session only)
$env:PORT="8080"
$env:JWT_SECRET="your_secret"
$env:GIN_MODE="release"

# Check if set
echo $env:PORT
```

### On Windows CMD
```batch
# Temporary
set PORT=8080
set JWT_SECRET=your_secret

# Check if set
echo %PORT%
```

### Permanent (Windows System)
1. Press `Win + X` → "System"
2. Advanced system settings → Environment Variables
3. New → Add your variables

---

## Useful Links (Copy-Paste Ready)

```
GitHub: https://github.com/signup
Render: https://render.com
Vercel: https://vercel.com
```

---

## Before You Start

### Required
- [ ] GitHub account
- [ ] Code committed locally
- [ ] Render account
- [ ] Vercel account (if deploying frontend)

### Good to Have
- [ ] Terminal/PowerShell access
- [ ] Git installed
- [ ] Go installed (for local testing)
- [ ] Node.js installed (for frontend)

### Nice to Have
- [ ] Vercel CLI installed
- [ ] Git GUI tool (GitHub Desktop)
- [ ] VS Code (for editing)

---

## Quick Command Reference

```bash
# Git basics
git init                    # Initialize
git add .                   # Stage files
git commit -m "msg"         # Commit
git push                    # Push to GitHub

# Build backend
cd backend && go build -o app .

# Build mobile
cd mobile/android
./gradlew.bat assembleDebug

# Build frontend
npm run build
```

---

## Copy-Paste Commands

Ready-to-use commands for your specific project:

### First time setup
```bash
cd c:\Users\camer\github
git init
git config user.name "Your Name"
git config user.email "your@email.com"
git add .
git commit -m "Initial commit: BienestarApp full stack"
git remote add origin https://github.com/YOUR_USERNAME/bienestarapp.git
git branch -M main
git push -u origin main
```

### After code changes
```bash
cd c:\Users\camer\github
git add .
git commit -m "Your change message"
git push
```

### Rebuild APK
```bash
cd c:\Users\camer\github\mobile\android
./gradlew.bat clean
./gradlew.bat assembleDebug
# Find APK at: app\build\outputs\apk\debug\app-debug.apk
```

---

## When Things Go Wrong

### Git error: "fatal: not a git repository"
```bash
cd c:\Users\camer\github
git init
```

### Git error: "authentication failed"
- Make sure you're using GitHub username (not email)
- Generate personal access token: https://github.com/settings/tokens

### Build error: "gradle not found"
```bash
cd c:\Users\camer\github\mobile\android
# Run the wrapper (not gradle directly)
./gradlew.bat assembleDebug
```

### Port already in use
```bash
# Change PORT env var
$env:PORT="8081"
./app
```

---

## Remember

- **Always commit before deploying:** `git commit` first
- **Always push to GitHub:** `git push` before Render can deploy
- **Always rebuild APK after code changes:** `./gradlew.bat assembleDebug`
- **Always set environment variables:** Before running locally

---

**Last updated:** January 10, 2026
