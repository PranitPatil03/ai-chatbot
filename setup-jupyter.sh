#!/bin/bash

# 🚀 Jupyter Notebook Integration Setup Script
# This script sets up the Jupyter Kernel Gateway for your AI chatbot

set -e

echo "🎯 Setting up Jupyter Notebook Integration..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

echo -e "${GREEN}✅ Docker is installed${NC}"

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    echo "Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}✅ Docker Compose is installed${NC}"

# Generate a random auth token if not set
if [ -z "$JUPYTER_AUTH_TOKEN" ]; then
    JUPYTER_AUTH_TOKEN=$(openssl rand -hex 32)
    echo ""
    echo -e "${YELLOW}📝 Generated Jupyter Auth Token:${NC}"
    echo "$JUPYTER_AUTH_TOKEN"
    echo ""
    echo -e "${YELLOW}⚠️  Save this token! Add it to your .env.local file:${NC}"
    echo "JUPYTER_AUTH_TOKEN=$JUPYTER_AUTH_TOKEN"
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "JUPYTER_AUTH_TOKEN=$JUPYTER_AUTH_TOKEN" > .env
    echo "JUPYTER_PORT=8888" >> .env
    echo -e "${GREEN}✅ Created .env file${NC}"
fi

# Create .env.local for Next.js if it doesn't exist
if [ ! -f .env.local ]; then
    cat > .env.local << EOF
# Jupyter Kernel Gateway Configuration
JUPYTER_KERNEL_GATEWAY_URL=http://localhost:8888
JUPYTER_AUTH_TOKEN=$JUPYTER_AUTH_TOKEN
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF
    echo -e "${GREEN}✅ Created .env.local file${NC}"
else
    echo -e "${YELLOW}⚠️  .env.local already exists. Please add these lines manually:${NC}"
    echo "JUPYTER_KERNEL_GATEWAY_URL=http://localhost:8888"
    echo "JUPYTER_AUTH_TOKEN=$JUPYTER_AUTH_TOKEN"
    echo "NEXT_PUBLIC_APP_URL=http://localhost:3000"
fi

# Create workspace directory
mkdir -p jupyter_workspace
echo -e "${GREEN}✅ Created jupyter_workspace directory${NC}"

# Install Node.js dependencies
echo ""
echo "📦 Installing Node.js dependencies..."
if command -v pnpm &> /dev/null; then
    pnpm add axios
    echo -e "${GREEN}✅ Installed axios via pnpm${NC}"
elif command -v npm &> /dev/null; then
    npm install axios
    echo -e "${GREEN}✅ Installed axios via npm${NC}"
else
    echo -e "${RED}❌ Neither pnpm nor npm found. Please install Node.js dependencies manually:${NC}"
    echo "npm install axios"
fi

# Start Docker Compose
echo ""
echo "🐳 Starting Jupyter Kernel Gateway with Docker Compose..."
docker-compose up -d

# Wait for Jupyter to be ready
echo ""
echo "⏳ Waiting for Jupyter Kernel Gateway to be ready..."
sleep 5

MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f -s "http://localhost:8888/api" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Jupyter Kernel Gateway is ready!${NC}"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Waiting... (attempt $RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}❌ Jupyter Kernel Gateway failed to start within expected time${NC}"
    echo "Check logs with: docker-compose logs jupyter-kernel"
    exit 1
fi

# Test the connection
echo ""
echo "🧪 Testing Jupyter Kernel Gateway..."
if curl -f -s -H "Authorization: token $JUPYTER_AUTH_TOKEN" "http://localhost:8888/api/kernels" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Successfully connected to Jupyter Kernel Gateway${NC}"
else
    echo -e "${RED}❌ Failed to connect to Jupyter Kernel Gateway${NC}"
    echo "Check logs with: docker-compose logs jupyter-kernel"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Jupyter Kernel Gateway is running at: http://localhost:8888"
echo "Auth Token: $JUPYTER_AUTH_TOKEN"
echo ""
echo "📝 Next steps:"
echo "1. Start your Next.js app: pnpm dev"
echo "2. Test the integration by asking the AI to run Python code"
echo ""
echo "🛠️  Useful commands:"
echo "  - View logs:    docker-compose logs -f jupyter-kernel"
echo "  - Stop:         docker-compose down"
echo "  - Restart:      docker-compose restart"
echo "  - Test kernel:  curl -H 'Authorization: token $JUPYTER_AUTH_TOKEN' http://localhost:8888/api/kernels"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
