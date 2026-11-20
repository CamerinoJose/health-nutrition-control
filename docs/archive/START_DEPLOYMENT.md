# DEPLOYMENT QUICK START

## What You'll Get (40 Minutes)
- ✅ Backend on cloud (Render)
- ✅ APK works everywhere
- ✅ Share with testers
- ✅ Free to start ($7/mo if it grows)

---

## Pick Your Guide

### Option 1: Visual Learner
**File:** `RENDER_VISUAL_GUIDE.md`
- Diagrams & flowcharts
- Understand the "why"
- 10 minutes

### Option 2: Step-by-Step Beginner
**File:** `GITHUB_SETUP_GUIDE.md`
- Learn Git in detail
- Every step explained
- 10 minutes

### Option 3: Ready to Deploy
**File:** `RENDER_DEPLOYMENT_GUIDE.md`
- Complete instructions
- All steps in one place
- 30 minutes

### Option 4: Checklist Format
**File:** `RENDER_QUICK_CHECKLIST.md`
- Checkbox tracking
- Progress monitoring
- Reference

### Option 5: Just Commands
**File:** `COMMANDS_CHEATSHEET.md`
- Copy-paste ready
- Quick reference
- All commands

---

## Timeline

```
Read guides:        20-30 min
GitHub setup:       10 min
Deploy backend:     15 min
Update APK:         5 min
Test:              5-10 min
─────────────────────────
TOTAL:             50-70 min
```

---

## Cost

- **Free Tier:** $0 completely free
- **Paid (if grows):** $7-25/month
- **Enterprise:** $50+/month (only if millions of users)

---

## Your Next Step

**Choose ONE file above and open it:**

1. **If new to deployment:** Open `RENDER_VISUAL_GUIDE.md` first
2. **If new to Git:** Open `GITHUB_SETUP_GUIDE.md` first
3. **If ready to deploy:** Open `RENDER_DEPLOYMENT_GUIDE.md` now
4. **If organized:** Use `RENDER_QUICK_CHECKLIST.md`
5. **If need commands:** See `COMMANDS_CHEATSHEET.md`

---

## All Files Created

```
✅ RENDER_VISUAL_GUIDE.md
✅ GITHUB_SETUP_GUIDE.md
✅ RENDER_DEPLOYMENT_GUIDE.md
✅ RENDER_QUICK_CHECKLIST.md
✅ COMMANDS_CHEATSHEET.md
✅ DEPLOYMENT_GUIDES_INDEX.md
✅ GUIDES_SUMMARY.md
✅ DEPLOYMENT_COMPLETE_OVERVIEW.md
```

---

## Success = These Steps

1. Create GitHub account
2. Push code to GitHub
3. Sign up Render
4. Deploy backend (15 min)
5. Update APK URL
6. Rebuild APK
7. Share with testers
8. Get feedback

**That's it! You're live!**

---

## Quick Commands Cheat Sheet

```bash
# GitHub
git init
git add .
git commit -m "Initial commit"
git push

# Build APK
cd mobile/android
./gradlew.bat assembleDebug

# Find APK
# mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Still Have Issues?

If you can't open files in VS Code:

1. Try refreshing: `Ctrl + Shift + P` → "Developer: Reload Window"
2. Try closing and reopening VS Code
3. Open files from terminal: `code RENDER_VISUAL_GUIDE.md`
4. Or read the guide content below

---

## Quick Start Guide (If You Can't Open Files)

### STEP 1: GitHub (10 min)
```bash
cd c:\Users\camer\github
git init
git config user.name "Your Name"
git config user.email "your@email.com"
git add .
git commit -m "Initial commit"
```

Then on GitHub.com:
- Create account
- Create repo named `bienestarapp`
- Run the commands GitHub shows

### STEP 2: Render (15 min)
1. Go to https://render.com
2. Sign up with GitHub
3. Click "New Web Service"
4. Select your repo
5. Fill in:
   - Name: `bienestarapp-backend`
   - Environment: `Go`
   - Build: `go build -o app .`
   - Start: `./app`
   - Root: `backend/`
6. Add env vars:
   - PORT: `8080`
   - JWT_SECRET: `render_secret_key`
   - GIN_MODE: `release`
7. Deploy!

### STEP 3: Update APK (5 min)
Edit `mobile/App.js`, find:
```javascript
const BACKEND_URL = 'https://nonillusional-searingly-loren.ngrok-free.dev'
```

Replace with your Render URL (from dashboard):
```javascript
const BACKEND_URL = 'https://bienestarapp-backend.onrender.com'
```

Then:
```bash
cd mobile/android
./gradlew.bat assembleDebug
```

### STEP 4: Test & Share (5 min)
- APK location: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`
- Share link with testers
- Test accounts:
  - `test@test.com` / `test123`
  - `nutriologa@bien.com` / `demo123`

---

## YOU'RE DONE!

Your app is now on cloud infrastructure accessible to anyone!

---

**Guides available in your project folder. Pick one and start!**
