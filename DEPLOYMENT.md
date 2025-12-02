# Unit Sales Tracker - Vercel Deployment Guide

## Prerequisites
1. Vercel account (free tier works)
2. Supabase project with database set up
3. GitHub repository (recommended)

## Deployment Steps

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Push code to GitHub** (if not already):
   ```bash
   git add .
   git commit -m "Ready for Vercel deployment"
   git push origin main
   ```

2. **Go to [Vercel Dashboard](https://vercel.com/dashboard)**
   - Click "Add New..." → "Project"
   - Import your GitHub repository
   - Vercel will auto-detect it's a Vite project

3. **Configure Environment Variables**:
   Add these in Vercel project settings:
   - `VITE_SUPABASE_URL` = Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = Your Supabase anon/public key

4. **Deploy**:
   - Click "Deploy"
   - Wait 2-3 minutes for build to complete
   - Your app will be live at `https://your-project.vercel.app`

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```
   - Follow the prompts
   - Add environment variables when asked
   - Confirm deployment

4. **Deploy to Production**:
   ```bash
   vercel --prod
   ```

## Environment Variables Required

Get these from your Supabase project dashboard (Settings → API):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## Post-Deployment

1. **Test the deployment**:
   - Visit your Vercel URL
   - Try logging in
   - Check all features work

2. **Configure Custom Domain** (optional):
   - Go to Vercel project settings
   - Add your custom domain
   - Update DNS records as instructed

3. **Set up Automatic Deployments**:
   - Vercel automatically deploys on every push to main branch
   - Preview deployments created for pull requests

## Troubleshooting

### Build Errors
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify environment variables are set correctly

### Runtime Errors
- Check browser console for errors
- Verify Supabase connection works
- Check Supabase RLS policies allow anonymous access where needed

### 404 Errors on Refresh
- Already configured in `vercel.json` with rewrites
- All routes redirect to `index.html` for SPA behavior

## Files Created for Vercel

- ✅ `vercel.json` - Vercel configuration
- ✅ `.vercelignore` - Files to exclude from deployment
- ✅ `DEPLOYMENT.md` - This guide

## Continuous Deployment

Every push to `main` branch will trigger automatic deployment:
1. Vercel detects the push
2. Runs `npm install`
3. Runs `npm run build`
4. Deploys the `dist` folder
5. Your site is live in ~2 minutes!

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- [Supabase Documentation](https://supabase.com/docs)
