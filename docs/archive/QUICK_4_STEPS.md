# DEPLOYMENT IN 4 STEPS (Quick Version)

**Time: ~1 hour | Cost: Free**

---

## STEP 1: GitHub (10 min)

```bash
cd c:\Users\camer\github
git init
git config user.name "Your Name"
git config user.email "your@email.com"
git add .
git commit -m "Initial commit"
```

Then:
1. Go https://github.com/signup → Create account
2. Create repo: `bienestarapp`
3. Copy commands GitHub shows
4. Paste into PowerShell (git remote, git branch, git push)

---

## STEP 2: Render Backend (15 min)

1. Go https://render.com
2. Sign up with GitHub
3. Click "New Web Service"
4. Select repo, Root: `backend/`
5. Fill form:
   - Name: `bienestarapp-backend`
   - Build: `go build -o app .`
   - Start: `./app`
6. Add env vars (click "Add Environment Variable"):
   - `PORT` = `8080`
   - `JWT_SECRET` = `secret_key_here`
   - `GIN_MODE` = `release`
7. Click "Create Web Service"
8. Wait 2-5 min for deployment
9. **Copy your URL** (looks like: `https://bienestarapp-backend.onrender.com`)

---

## STEP 3: Update & Rebuild APK (10 min)

Edit `mobile/App.js` line ~35:

**Find:**
```javascript
const BACKEND_URL = 'https://nonillusional-searingly-loren.ngrok-free.dev'
```

**Replace with your Render URL:**
```javascript
const BACKEND_URL = 'https://bienestarapp-backend.onrender.com'
```

Save & rebuild:
```bash
cd c:\Users\camer\github\mobile\android
./gradlew.bat clean
./gradlew.bat assembleDebug
```

---

## STEP 4: Share APK (5 min)

Find your APK:
```
c:\Users\camer\github\mobile\android\app\build\outputs\apk\debug\app-debug.apk
```

Share with testers! 🎉

Test credentials:
- `test@test.com` / `test123`
- `nutriologa@bien.com` / `demo123`

---

## DONE! 🚀

Your app is now:
- ✅ In the cloud
- ✅ Accessible 24/7
- ✅ Shareable with others
- ✅ Professional infrastructure
- ✅ Completely free

---

## If You Get Stuck

Read: `IF_FILES_WONT_OPEN.md`

Or check: `COMMANDS_CHEATSHEET.md`

---

**That's it! You're live!**
