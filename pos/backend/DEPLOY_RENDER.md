# Deploying POS Backend to Render

This guide explains how to deploy the POS backend to Render.

## Prerequisites

1. A GitHub account with this repository pushed
2. A Render account (free tier works)
3. A MongoDB Atlas account with a cluster set up

## MongoDB Atlas Setup

1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free cluster (M0 tier)
3. Create a database user with read/write access
4. Whitelist all IPs: `0.0.0.0/0` (required for Render)
5. Get your connection string from "Connect" → "Connect your application"
   - It looks like: `mongodb+srv://username:password@cluster.mongodb.net/pos-system`

## Render Deployment Steps

### Option 1: One-Click Deploy (Blueprint)

1. Push your code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click "New" → "Blueprint"
4. Connect your GitHub repo
5. Render will detect `render.yaml` and set up the service
6. Configure the required environment variables (see below)

### Option 2: Manual Setup

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `pos-backend`
   - **Region**: Singapore (or closest to you)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or Starter for production)

5. Add environment variables (see below)
6. Click "Create Web Service"

## Required Environment Variables

Set these in Render's dashboard under "Environment":

| Variable | Value | Required |
|----------|-------|----------|
| `NODE_ENV` | `production` | ✅ |
| `CLOUD_ONLY` | `true` | ✅ |
| `ENABLE_SYNC` | `false` | ✅ |
| `MONGODB_URI` | Your MongoDB Atlas connection string | ✅ |
| `FRONTEND_URL` | Your Vercel frontend URL (e.g., `https://your-app.vercel.app`) | ✅ |
| `EMAIL_USER` | Gmail address for sending emails | ✅ |
| `EMAIL_PASS` | Gmail app-specific password | ✅ |
| `ENCRYPTION_SECRET` | 64-character hex string | ✅ |
| `STORE_NAME` | `CreateYourStyle` | Optional |
| `STORE_ADDRESS` | `Pasonanca, Zamboanga City` | Optional |

### Generate Encryption Secret

Run this command to generate a secure encryption secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Gmail App Password

1. Enable 2-Factor Authentication on your Google account
2. Go to Google Account → Security → App passwords
3. Generate a new app password for "Mail"
4. Use this password (not your regular Gmail password)

## After Deployment

1. Note your Render URL (e.g., `https://pos-backend-xxxx.onrender.com`)
2. Update your Vercel frontend's `VITE_API_URL` environment variable to this URL
3. Test the API by visiting `https://your-backend.onrender.com/api/ping`

## Health Check

Render will use `/api/ping` to check if your service is healthy. This endpoint returns:
```json
{ "ok": true }
```

## Free Tier Limitations

On Render's free tier:
- Service spins down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds (cold start)
- 750 hours/month of free usage

For production, consider upgrading to the Starter plan ($7/month) for:
- No spin-down
- Better performance
- More resources

## Troubleshooting

### CORS Errors
Ensure `FRONTEND_URL` is set correctly to your Vercel domain.

### Database Connection Failed
1. Check `MONGODB_URI` is correct
2. Ensure MongoDB Atlas allows connections from all IPs (`0.0.0.0/0`)
3. Check your database user has the correct permissions

### Service Won't Start
1. Check Render logs for errors
2. Ensure all required environment variables are set
3. Verify `package.json` has correct start script

### Emails Not Sending
1. Ensure Gmail app password is used (not regular password)
2. Enable "Less secure app access" or use app-specific password
3. Check `EMAIL_USER` and `EMAIL_PASS` are set correctly

## WebSocket Support

The backend includes WebSocket support for real-time payment updates. The WebSocket endpoint is:
```
wss://your-backend.onrender.com/ws/payments
```

Note: Free tier may have issues with long-lived WebSocket connections due to spin-down.
