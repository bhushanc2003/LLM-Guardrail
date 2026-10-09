# Use Python 3.9 slim base image
FROM python:3.9-slim

# Prevent Python from writing .pyc files & enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set working directory inside container
WORKDIR /app

# Install system build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Create data directory for persistent audit logs
RUN mkdir -p /app/data

# Copy application source code
COPY . .

# Expose port 8080 and 80
EXPOSE 8080
EXPOSE 80

# Environment defaults
ENV HOST="0.0.0.0"
ENV PORT="8080"
ENV DATABASE_URL="postgresql://neondb_owner:npg_BIrh05EqdNPs@ep-sweet-grass-b3v25j2p-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
ENV UPSTREAM_BASE_URL="https://ai-gpu-node.tailfa114b.ts.net/api/v1"
ENV DEFAULT_MODEL_ID="nvidia/Qwen3.6-35B-A3B-NVFP4"
ENV EMBEDDING_MODEL_ID="BAAI/bge-small-en-v1.5"

# Command to launch proxy platform
CMD ["python3", "-m", "uvicorn", "pii_proxy.main:app", "--host", "0.0.0.0", "--port", "8080"]
