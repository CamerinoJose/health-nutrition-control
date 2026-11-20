# Step-by-Step: Get Your Code on GitHub

This is the FIRST step before deploying to Render. **Takes ~10 minutes.**

---

## Why GitHub?

Render can only deploy from GitHub repos. So we need to push your code there first.

---

## Part 1: Create GitHub Account (Skip if you have one)

### 1. Go to https://github.com/signup

You'll see a signup form.

### 2. Fill in:
- **Username:** Something like `camerino-dev` (pick your own)
- **Email:** Your email address
- **Password:** Something secure
- Click **"Create account"**

### 3. Verify email
- GitHub will send you an email
- Click the verification link
- Done! You have a GitHub account

**Tip:** Remember your USERNAME - you'll need it later!

---

## Part 2: Initialize Git on Your Computer

Git is the version control system. It tracks changes to your code.

### 1. Open Terminal/PowerShell

On Windows, press: `Win + R`, type `powershell`, press Enter

Or just open **CMD** or **PowerShell**

### 2. Navigate to your project

```bash
cd c:\Users\camer\github
```

You should see all your files (type `dir` to list them)

### 3. Initialize git

```bash
git init
```

You'll see: `Initialized empty Git repository in ...`

### 4. Set your name and email

```bash
git config user.name "Your Real Name"
git config user.email "your.email@gmail.com"
```

**Example:**
```bash
git config user.name "Jose Camerino"
git config user.email "camerinojose@gmail.com"
```

✅ **Done!** Git is now initialized in your project.

---

## Part 3: Create .gitignore File

This tells Git which files to ignore (don't track).

### 1. Create file

In your project root (`c:\Users\camer\github\`), create a file named `.gitignore`

**On Windows:**
- Right-click → New → Text Document
- Name it: `.gitignore` (keep the dot)
- Open it with Notepad

### 2. Paste this content

```
# Dependencies
node_modules/
package-lock.json

# Environment
.env
.env.local
.env.*.local

# Executables
*.exe
*.exe~

# Databases
*.db
*.db-shm
*.db-wal
app.db
data.db

# Uploads
uploads/

# Build outputs
dist/
build/
*.o

# OS files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# IDE
.vscode/
.idea/

# Logs
*.log
server.log

# Expo
.expo/

# Android
mobile/android/.gradle/
mobile/android/build/
mobile/android/local.properties
mobile/android/app/build/

# Other temp files
*.tmp
*.swp
*.swo
```

### 3. Save the file

Make sure it's named exactly: `.gitignore` (with the dot)

✅ **Done!** Git knows what to ignore.

---

## Part 4: Commit Your Code

Now we tell Git to track all your code.

### 1. Check status

```bash
git status
```

You'll see lots of files listed (red = not tracked yet)

### 2. Add all files

```bash
git add .
```

The dot (.) means "all files"

### 3. Check status again

```bash
git status
```

Now you should see files are green (ready to commit)

### 4. Create first commit

```bash
git commit -m "Initial commit: BienestarApp full stack"
```

You'll see something like:
```
[main (root-commit) abc1234] Initial commit
 150 files changed, 50000 insertions(+)
```

✅ **Done!** Your code is committed locally.

---

## Part 5: Create Repository on GitHub

Now we create a home for your code on GitHub.

### 1. Go to https://github.com (logged in)

Click the **"+"** icon in top right

Click **"New repository"**

### 2. Fill in the form

```
Repository name: bienestarapp
Description: Nutrition and wellness app with mobile + web
Public: ✓ (checked - so Render can access)
Initialize: ☐ (unchecked - we already have code)
```

### 3. Click "Create repository"

GitHub will show you commands to run.

✅ **You now have an empty repo on GitHub!**

---

## Part 6: Push Code to GitHub

This connects your local code to GitHub and uploads it.

### 1. Copy the commands GitHub shows

You'll see something like:

```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/bienestarapp.git
git push -u origin main
```

### 2. Run these commands in your terminal

One by one:

```bash
git branch -M main
```

Then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/bienestarapp.git
```

Replace `YOUR_USERNAME` with your actual GitHub username!

**Example:**
```bash
git remote add origin https://github.com/camerino-dev/bienestarapp.git
```

Then:

```bash
git push -u origin main
```

You might be asked for GitHub credentials. Enter your GitHub username and password.

### 3. Wait for upload

You'll see something like:

```
Enumerating objects: 500, done.
Counting objects: 100% (500/500), done.
Compressing objects: 100% (450/450), done.
Writing objects: 100% (500/500), 5.00 MiB | 1.50 MiB/s, done.
Sending data to GitHub...
```

This takes 1-2 minutes (lots of files!).

✅ **Your code is now on GitHub!**

---

## Part 7: Verify It Worked

### 1. Go to GitHub

Visit: `https://github.com/YOUR_USERNAME/bienestarapp`

Replace YOUR_USERNAME with your actual username!

### 2. You should see

- Your repo name: **bienestarapp**
- All your files listed (backend/, frontend/, mobile/, etc.)
- Your commit message: "Initial commit: BienestarApp full stack"

### 3. Explore the files

Click on files to see the code. GitHub can display them nicely.

✅ **Perfect! Your code is on GitHub!**

---

## Now You're Ready!

You've completed the hardest step. Now you can:

1. ✅ Deploy to Render (backend)
2. ✅ Deploy to Vercel (frontend)
3. ✅ Share with testers

---

## Troubleshooting

### "fatal: not a git repository"
- Make sure you're in the right directory
- Run: `cd c:\Users\camer\github`
- Then: `git status`

### "authentication failed"
- Use your GitHub username (not email) when prompted
- Use your GitHub password (or personal access token)

### "Everything up-to-date"
- This means code is already pushed
- Go to GitHub and verify files are there

### Files not showing on GitHub
- Might be a large file issue
- Try: `git push` again
- Check `.gitignore` is working

---

## What's Next?

Once GitHub is done:

1. **Go to Render.com** (see main deployment guide)
2. **Sign up with GitHub** (super easy!)
3. **Connect your repo** (Render can see it)
4. **Deploy!** (Render builds and deploys automatically)

---

## Quick Reference

```bash
# Check status
git status

# Add changes
git add .

# Commit
git commit -m "Your message"

# Push to GitHub
git push
```

---

**You've got this! Once GitHub is done, the rest is easy.** 🚀
