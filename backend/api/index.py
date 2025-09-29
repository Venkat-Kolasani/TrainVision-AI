# Vercel serverless function wrapper
from main import app

# This is required for Vercel
def handler(request, context):
    return app(request, context)