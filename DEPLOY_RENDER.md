# Deploy TrainVision AI Backend to Render.com

## Step 1: Prepare Your Repository
Make sure your code is pushed to GitHub with all the recent changes.

## Step 2: Sign Up for Render
1. Go to [render.com](https://render.com)
2. Sign up with your GitHub account
3. Authorize Render to access your repositories

## Step 3: Create Web Service
1. Click **"New +"** button
2. Select **"Web Service"**
3. Choose **"Build and deploy from a Git repository"**
4. Select your **TrainVision-AI** repository

## Step 4: Configure Service
Fill in these settings:

- **Name**: `trainvision-backend`
- **Root Directory**: `backend`
- **Environment**: `Python 3`
- **Region**: Choose closest to your users
- **Branch**: `main`
- **Build Command**: 
  ```
  pip install -r requirements-prod.txt
  ```
- **Start Command**: 
  ```
  gunicorn --bind 0.0.0.0:$PORT --workers 2 --worker-class uvicorn.workers.UvicornWorker main:app
  ```

## Step 5: Environment Variables
Add these environment variables:

| Key | Value |
|-----|-------|
| `GEMINI_API_KEY` | Your Gemini API key from Google |
| `GEMINI_MODEL` | `gemini-2.5-flash` |
| `PYTHON_VERSION` | `3.11.7` |
| `REDIS_URL` | *(optional)* Redis connection URL for multi-worker WebSocket fan-out — e.g. Render Redis or `redis://localhost:6379/0` |

### Optional Redis (multi-worker WebSockets)

Render runs Gunicorn with **2 workers**. Without Redis, WebSocket clients only receive broadcasts from the worker they are connected to.

1. Create a Redis instance (Render Redis, Upstash, or local `docker compose up redis`)
2. Set `REDIS_URL` on the backend service
3. Verify: `GET /health` returns `"redis": "connected"`

Local full-stack with Redis:

```bash
docker compose up -d redis
export REDIS_URL=redis://localhost:6379/0
cd backend && python main.py
```

If `REDIS_URL` is unset, the API runs in single-worker mode (still functional for development).

## Step 6: Deploy
1. Click **"Create Web Service"**
2. Wait for deployment (5-10 minutes)
3. Your backend will be available at: `https://trainvision-backend.onrender.com`

## Step 7: Test Your Deployment
Visit: `https://your-service-name.onrender.com/ai/status`

You should see:
```json
{
  "gemini_configured": true,
  "model": "gemini-2.5-flash",
  "api_key_set": true
}
```

## Step 8: Update Frontend
Update your frontend `.env.production` file:
```
VITE_API_BASE_URL=https://your-service-name.onrender.com
```

## 🎉 Done!
Your backend is now live and ready to use!

### 💡 Pro Tips:
- Render free tier gives you 750 hours/month (enough for 24/7)
- Services sleep after 15 minutes of inactivity (first request may be slow)
- Automatic deployments on every git push to main branch
- Free SSL certificates included