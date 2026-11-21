# Render Deployment Quick Checklist

## ☐ Before You Start
- [ ] You have internet connection
- [ ] Your code is saved locally
- [ ] You have an email for signing up

## ☐ STEP 1: GitHub Setup (10 min)
- [ ] Create GitHub account (if needed): https://github.com/signup
- [ ] Initialize Git: `git init` in project folder
- [ ] Create `.gitignore` file with exclusions
- [ ] First commit: `git add . && git commit -m "Initial commit"`
- [ ] Create repo on GitHub
- [ ] Push code: `git push -u origin main`

**Test:** Visit https://github.com/YOUR_USERNAME/bienestarapp - should see your code

## ☐ STEP 2: Create Render Account (2 min)
- [ ] Go to https://render.com
- [ ] Sign up with GitHub
- [ ] Authorize Render

**Test:** You should see "Dashboard" when logged in

## ☐ STEP 3: Deploy Backend (10 min)
- [ ] Click "New +" → "Web Service"
- [ ] Select `bienestarapp` repo, click Connect
- [ ] Fill form:
  - Name: `bienestarapp-backend`
  - Environment: `Go`
  - Build: `go build -o app .`
  - Start: `./app`
  - Type: `Free`
  - Root Directory: `backend/`
- [ ] Add Environment Variables:
  - `PORT` = `8080`
  - `JWT_SECRET` = `render_production_secret_change_this_in_production`
  - `GIN_MODE` = `release`
- [ ] Click "Create Web Service"
- [ ] Wait for build (watch logs)
- [ ] Copy Service URL when ready

**Test:** Backend URL should show at top of page
Example: `https://bienestarapp-backend.onrender.com`

## ☐ STEP 4: Update Mobile App (5 min)
- [ ] Open `mobile/App.js`
- [ ] Find line with `const BACKEND_URL = ...`
- [ ] Replace with your Render URL
- [ ] Save file
- [ ] Run: `cd mobile/android && ./gradlew.bat assembleDebug`
- [ ] Wait for build to finish

**Test:** Check `mobile/android/app/build/outputs/apk/debug/app-debug.apk` exists

## ☐ STEP 5: (Optional) Deploy Frontend to Vercel (5 min)
- [ ] Go to https://vercel.com/signup
- [ ] Sign up with GitHub
- [ ] Click "New Project"
- [ ] Select `bienestarapp` repo
- [ ] Set Root: `frontend/`
- [ ] Add Env Var: `VITE_API_URL` = your Render URL
- [ ] Click Deploy

**Test:** Check Vercel dashboard for URL
Example: `https://bienestarapp.vercel.app`

## ☐ STEP 6: Test Everything (5 min)

### Test Backend
- [ ] Open browser: `https://YOUR_RENDER_URL/api/me`
- [ ] Should see error (401) - that's OK, means it's working

### Test Mobile App
- [ ] Uninstall old APK from phone
- [ ] Install new APK with cloud backend
- [ ] Login with: `test@test.com` / `test123`
- [ ] Can see dashboard ✓

### Test Frontend (if deployed)
- [ ] Open your Vercel URL in browser
- [ ] See login page ✓
- [ ] Login works ✓

## ☐ STEP 7: Share with Testers
- [ ] Upload APK to Google Drive / file sharing site
- [ ] Share download link
- [ ] Share test credentials
- [ ] Get feedback!

---

## Common Issues & Fixes

### Backend won't build?
1. Check Render logs (click service → Logs)
2. Make sure `backend/go.mod` exists
3. Check `backend/main.go` exists
4. Push changes: `git add . && git commit -m "fix" && git push`

### Backend builds but says error?
1. Check env variables are set correctly
2. Check logs for specific error message
3. Verify `PORT` environment variable is set

### Mobile app can't login?
1. Make sure you updated `BACKEND_URL` correctly
2. Make sure you rebuilt APK after changing
3. Check Render service is still running (green status)
4. Wait 1-2 minutes after deploying (startup time)

### Database empty after deploy?
1. That's normal - SQLite is file-based
2. Each deploy creates fresh database
3. Run seed scripts if needed
4. For persistent data, upgrade to PostgreSQL

---

## Cost Breakdown

| Service | Free Tier | Cost After |
|---------|-----------|-----------|
| Render Backend | Yes | $7/month |
| Vercel Frontend | Yes | $0 (always free) |
| PostgreSQL | 90 days | $15/month |
| **TOTAL** | **$0** | **~$22/month** |

For MVP testing: **Completely free!**

---

## Time Estimates

| Step | Time |
|------|------|
| 1. GitHub setup | 10 min |
| 2. Render signup | 2 min |
| 3. Deploy backend | 10 min |
| 4. Update mobile app | 5 min |
| 5. Deploy frontend | 5 min |
| 6. Testing | 5 min |
| **TOTAL** | **~40 min** |

---

## Test Accounts

```
PATIENT:
Email: test@test.com
Password: test123

NUTRITIONIST:
Email: nutriologa@bien.com
Password: demo123

ADMIN:
Email: admin@admin.com
Password: admin123
```

---

## Links to Remember

- GitHub: https://github.com/YOUR_USERNAME/bienestarapp
- Render Dashboard: https://dashboard.render.com
- Your Backend: https://bienestarapp-backend.onrender.com
- Your Frontend: https://YOUR_VERCEL_URL.vercel.app (if deployed)

---

**Ready? Start with STEP 1! 🚀**

When you finish each step, update the checkbox above.
