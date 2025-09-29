# Gunicorn configuration optimized for Render free tier
import os

# Server socket
bind = f"0.0.0.0:{os.getenv('PORT', '10000')}"
backlog = 2048

# Worker processes
workers = 1  # Only 1 worker for free tier to avoid memory issues
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000
timeout = 120  # Increased timeout for AI operations
keepalive = 2

# Memory management
max_requests = 1000  # Restart worker after 1000 requests to prevent memory leaks
max_requests_jitter = 50
preload_app = True

# Logging
loglevel = "info"
accesslog = "-"
errorlog = "-"

# Process naming
proc_name = "trainvision-backend"

# Worker timeout
graceful_timeout = 30
worker_tmp_dir = "/dev/shm"  # Use memory for temp files