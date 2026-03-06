# Deploying POS Frontend to Vercel

This guide explains how to deploy the POS frontend to Vercel and connect it to your Render backend.

## Prerequisites

1. A GitHub account with this repository pushed
2. A Vercel account (free tier works)
3. Your backend deployed to Render (or another hosting service)

## Deployment Steps

### 1. Push to GitHub

Make sure your code is pushed to GitHub:
```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push
```

### 2. Import to Vercel

1. Go to [Vercel](https://vercel.com) and sign in
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Select the `frontend` folder as the root directory

### 3. Configure Build Settings

Vercel should auto-detect Vite. Verify these settings:
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### 4. Set Environment Variables

In Vercel's project settings, add these environment variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `VITE_API_URL` | `https://your-backend.onrender.com` | Your Render backend URL |

**Important**: Replace `your-backend.onrender.com` with your actual Render backend URL.

### 5. Deploy

Click "Deploy" and wait for the build to complete.

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:5000` | Backend API base URL |
| `VITE_RECEIPT_LINE_WIDTH` | `32` | Receipt line width for printing |

## How API URL Routing Works

The frontend uses an API interceptor that automatically rewrites all `localhost:5000` URLs to your configured `VITE_API_URL`. This means:

- In development: API calls go to `http://localhost:5000`
- In production: API calls go to your Render backend URL

No code changes are needed when switching environments.

## Troubleshooting

### CORS Errors

If you see CORS errors, ensure your backend (on Render) allows requests from your Vercel domain:

```javascript
// In your backend's server.js
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://your-app.vercel.app',
    /\.vercel\.app$/  // Allow all Vercel preview deployments
  ],
  credentials: true
}));
```

### API Not Connecting

1. Check that `VITE_API_URL` is set correctly in Vercel
2. Ensure your Render backend is running
3. Check browser console for the API URL being used

### Build Failures

1. Ensure all dependencies are in `package.json`
2. Check for TypeScript/ESLint errors locally with `npm run build`

## Printing

The printing system uses `window.print()` for browser-based printing, which works without a backend printer connection. Users can:

1. Print to any system-connected printer
2. Save as PDF
3. Use network printers

## PWA Support

The app includes PWA (Progressive Web App) support:
- Works offline with cached data
- Can be installed on mobile devices
- Automatic updates when new versions deploy

## Custom Domain

To use a custom domain:
1. Go to Project Settings → Domains
2. Add your domain
3. Configure DNS as instructed by Vercel
