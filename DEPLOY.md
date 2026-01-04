# 🚀 Deploy to Vercel

## Step 1: Train the Model

First, train the model using your strikeout data:

```bash
python train_model.py
```

This creates `public/model_data.json` with all the learned patterns.

## Step 2: Install Dependencies

```bash
npm install
```

## Step 3: Test Locally

```bash
npm run dev
```

Visit `http://localhost:3000` to test the app.

## Step 4: Deploy to Vercel

### Option A: Using Vercel CLI

```bash
npm install -g vercel
vercel
```

Follow the prompts to deploy.

### Option B: Using GitHub

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your GitHub repository
5. Vercel will auto-detect Next.js and deploy

### Option C: Using Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Upload your project folder
4. Vercel will handle the rest

## Important Notes

- Make sure `public/model_data.json` is committed to your repo (it's needed for the app to work)
- The model file can be large - Vercel has a 50MB limit for serverless functions
- If the model is too large, consider using Vercel's Edge Functions or an external storage solution

## Environment Variables

No environment variables needed for basic setup.

## Custom Domain

After deployment, you can add a custom domain in the Vercel dashboard under your project settings.

## Troubleshooting

**Build fails?**
- Make sure `public/model_data.json` exists
- Check that all dependencies are in `package.json`

**API routes not working?**
- Ensure the model file is in the `public` folder
- Check Vercel function logs in the dashboard

**Model too large?**
- Consider compressing the JSON
- Or use a database/external storage for the model data

