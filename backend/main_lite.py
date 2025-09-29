# Lightweight version for deployment with reduced memory usage
import os
import sys
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import json
from typing import List, Dict, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="TrainVision AI API", 
    version="1.0.0",
    description="Railway Traffic Management and Optimization System"
)

# Configure CORS for production
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000", 
    "https://trainvision-ai.vercel.app",  # Add your frontend URL here
    FRONTEND_URL,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS + ["*"],  # Allow all for now, restrict in production
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Configure Gemini AI
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

gemini_model = None
if GEMINI_API_KEY:
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        gemini_model = genai.GenerativeModel(GEMINI_MODEL)
        print(f"✅ Gemini AI configured with model: {GEMINI_MODEL}")
    except Exception as e:
        print(f"⚠️ Gemini AI configuration failed: {e}")
else:
    print("⚠️ GEMINI_API_KEY not found in environment variables")

# Basic health check
@app.get("/")
def root():
    return {
        "message": "TrainVision AI Backend is running!",
        "version": "1.0.0",
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/ai/status")
def get_ai_status():
    """Check if Gemini AI is properly configured"""
    return {
        "gemini_configured": gemini_model is not None,
        "model": GEMINI_MODEL if gemini_model else None,
        "api_key_set": bool(GEMINI_API_KEY),
        "status": "ready" if gemini_model else "not_configured"
    }

# Simple AI endpoint for testing
@app.post("/ai/test")
async def test_ai(query: str = "Hello, how are you?"):
    """Test Gemini AI with a simple query"""
    if not gemini_model:
        raise HTTPException(status_code=503, detail="Gemini AI not configured")
    
    try:
        response = gemini_model.generate_content(query)
        return {
            "query": query,
            "response": response.text,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI test failed: {str(e)}")

# Lazy load the full application
_full_app_loaded = False

def load_full_app():
    """Lazy load the full application when needed"""
    global _full_app_loaded
    if _full_app_loaded:
        return
    
    try:
        # Import the full main module
        from main import *
        _full_app_loaded = True
        print("✅ Full application loaded successfully")
    except Exception as e:
        print(f"⚠️ Could not load full application: {e}")

# Proxy endpoint to load full app on demand
@app.get("/trains")
def get_trains_proxy():
    load_full_app()
    if _full_app_loaded:
        from main import get_trains
        return get_trains()
    else:
        # Return mock data if full app can't load
        return [
            {"id": "T101", "type": "Express", "status": "scheduled"},
            {"id": "T102", "type": "Local", "status": "scheduled"}
        ]

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)