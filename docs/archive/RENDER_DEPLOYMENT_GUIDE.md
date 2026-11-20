# Deploy to Render.com - Complete Guide

**Total Time: ~30 minutes**

This guide will help you deploy your BienestarApp to Render.com for free/cheap cloud hosting.

---

## STEP 1: Create GitHub Account & Push Code (If not done)

### 1a. If you DON'T have GitHub yet:
1. Go to https://github.com/signup
2. Create account with email/password
3. Verify email

### 1b. Initialize Git in your project

```bash
cd c:\Users\camer\github
git init
git config user.name "Your Name"
git config user.email "your.email@gmail.com"
```

### 1c. Create `.gitignore` file

Create file at `c:\Users\camer\github\.gitignore`:

```
node_modules/
.env
.env.local
*.exe
*.db
uploads/
dist/
.DS_Store
.expo/
build/
android/build/
.gradle/
local.properties
backend/data.db
backend/app.exe
mobile/android/app/build/
```

### 1d. Commit & push to GitHub

```bash
cd c:\Users\camer\github
git add .
git commit -m "Initial commit: BienestarApp full stack"
git branch -M main
```

Then on GitHub:
1. Click "+" → "New repository"
2. Name: `bienestarapp`
3. Description: `Nutrition and wellness app`
4. Public (so Render can access)
5. Click "Create repository"

Copy the commands GitHub shows and run them:

```bash
git remote add origin https://github.com/YOUR_USERNAME/bienestarapp.git
git push -u origin main
```

✅ **Result:** Your code is now on GitHub!

---

## STEP 2: Create Render Account

1. Go to https://render.com
2. Click "Get Started"
3. Sign up with GitHub (easiest!)
4. Authorize Render to access your GitHub repos

✅ **Result:** You have a Render account!

---

## STEP 3: Deploy Backend to Render

### 3a. Create a new Web Service

1. Log into Render dashboard: https://dashboard.render.com
2. Click **"New +"** button → **"Web Service"**
3. Select your `bienestarapp` repo
4. Click **"Connect"**

### 3b. Configure the Web Service

Fill out the form:

```
Name: bienestarapp-backend
Environment: Go
Build Command: go build -o app .
Start Command: ./app
Instance Type: Free
```

**Important: Change these settings:**

1. **Root Directory:** Set to `backend/` (scroll down to find this)

2. **Environment Variables:** Click "Add Environment Variable"
   
   Add these:
   
   | Key | Value |
   |-----|-------|
   | `PORT` | `8080` |
   | `JWT_SECRET` | `render_production_secret_change_this_in_production` |
   | `GIN_MODE` | `release` |

3. Click **"Create Web Service"**

### 3c. Wait for deployment

- Render will automatically build and deploy
- You'll see logs in real-time
- Takes 2-5 minutes
- When you see "Build successful", it's done!

### 3d. Get your backend URL

In the dashboard, look for the **Service URL** at the top (looks like):
```
https://bienestarapp-backend.onrender.com
```

**Copy this URL - you'll need it soon!**

✅ **Result:** Backend is live on Render!

---

## STEP 4: Set Up PostgreSQL Database (Optional but Recommended)

### If you want a cloud database instead of SQLite:

1. In Render dashboard, click **"New +"** → **"PostgreSQL"**
2. Name: `bienestarapp-db`
3. PostgreSQL Version: Latest
4. Instance Type: Free
5. Click **"Create Database"**

**Important:** 
- Free tier gets suspended after 90 days of inactivity
- For production, upgrade to paid plan

### To use PostgreSQL in your backend:

You'd need to update your Go code to use PostgreSQL instead of SQLite. For now, stick with **SQLite** (easier for MVP).

✅ **For MVP phase: You can skip this and just use SQLite**

---

## STEP 5: Update Mobile App to Use Cloud Backend

Now your backend is live! Update the APK to use the cloud URL.

### 5a. Edit App.js

Open [mobile/App.js](../mobile/App.js#L35)

**Find this line (around line 35):**

```javascript
const BACKEND_URL = 'https://nonillusional-searingly-loren.ngrok-free.dev'
```

**Replace with:**

```javascript
const BACKEND_URL = 'https://bienestarapp-backend.onrender.com'
```

(Use your actual Render URL from Step 3d)

### 5b. Rebuild APK

```bash
cd c:\Users\camer\github\mobile\android
./gradlew.bat assembleDebug
```

The new APK will be at:
```
mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

✅ **Result:** APK now uses cloud backend!

---

## STEP 6: Deploy Frontend (Optional - for Web Access)

If you want a web URL like `https://bienestarapp.vercel.app`:

### 6a. Go to Vercel.com

1. https://vercel.com/signup
2. Sign up with GitHub
3. Click "New Project"
4. Select your `bienestarapp` repo
5. Framework Preset: **React**
6. Root Directory: **frontend**

### 6b. Add Environment Variables

Click "Add" under Environment Variables:

```
VITE_API_URL = https://bienestarapp-backend.onrender.com
```

### 6c. Deploy

Click "Deploy"

Done! Your frontend is live on Vercel!

✅ **Result:** Frontend accessible at vercel app URL**

---

## STEP 7: Test Everything

### 7a. Test Backend

Open in browser:
```
https://bienestarapp-backend.onrender.com/api/me
```

Should return error (401 Unauthorized) - that's expected! Means backend is responding.

### 7b. Test Mobile App

1. Uninstall old APK from your device
2. Install new APK with cloud backend
3. Login with test account:
   - Email: `test@test.com`
   - Password: `test123`

4. Or nutritionist account:
   - Email: `nutriologa@bien.com`
   - Password: `demo123`

### 7c. Test Web (Optional)

If you deployed frontend:
```
https://YOUR_VERCEL_URL.vercel.app
```

Should see the login page!

✅ **Everything working!**

---

## STEP 8: Share with Testers

Now you can give others:

1. **APK Download Link:**
   ```
   Get from: mobile/android/app/build/outputs/apk/debug/app-debug.apk
   (Upload to Google Drive or similar)
   ```

2. **Web Link (if deployed):**
   ```
   https://YOUR_VERCEL_URL.vercel.app
   ```

3. **Test Credentials:**
   ```
   Patient:
   - Email: test@test.com
   - Password: test123
   
   Nutritionist:
   - Email: nutriologa@bien.com
   - Password: demo123
   
   Admin:
   - Email: admin@admin.com
   - Password: admin123
   ```

✅ **Others can now test your app!**

---

## Troubleshooting

### Backend won't build
- Check logs in Render dashboard
- Make sure `go.mod` and `main.go` are in root of `backend/` folder

### Backend builds but won't start
- Check PORT environment variable is set
- Check JWT_SECRET is set
- Review logs in Render

### Mobile app can't connect
- Make sure you updated `BACKEND_URL` in App.js
- Rebuild APK after changes
- Check Render backend URL is correct
- Wait 1-2 minutes after deploying (Render needs time to start)

### Database issues
- SQLite is file-based (stores in `data.db`)
- When you redeploy, database is reset
- To preserve data, use PostgreSQL instead

---

## What's Free on Render?

- ✅ Backend: **Free tier** (limited, shared CPU)
- ✅ PostgreSQL: **Free tier** (90 days, then suspended)
- ✅ Bandwidth: Included
- ⚠️ After free tier expires: $7/month for basic

**For MVP testing: Completely free!**

---

## Next Steps After Deployment

1. **Share with testers** - Get feedback
2. **Monitor Render dashboard** - Check for errors
3. **Collect feedback** - See what users think
4. **Make improvements** - Fix bugs/add features
5. **Upgrade if needed** - When app grows

---

## Quick Reference

| Component | URL |
|-----------|-----|
| Backend | `https://bienestarapp-backend.onrender.com` |
| Frontend | `https://YOUR_VERCEL_URL.vercel.app` |
| APK | Download from your PC |

---

## Still Stuck?

1. **Check Render Logs:** Dashboard → Service → Logs
2. **Check Vercel Logs:** Dashboard → Project → Deployments
3. **Common Issues:** See Troubleshooting section above
4. **Need help?** Let me know what error you see!

---

**You've got this! 🚀**

Once you complete these steps, your app will be live and shareable with others!
