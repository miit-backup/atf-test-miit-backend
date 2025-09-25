#!/bin/bash

echo "🚀 Starting Simple Docker Deployment"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
fi

# Check if .env file exists
if [ ! -f .env ]; then
    print_warning ".env file not found. Creating template..."
    cat > .env << EOL
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_APPLICATION_CREDENTIALS_BASE64=your_base64_credentials_here
WEATHER_API_KEY=your_weather_api_key_here
IPGEOLOCATION_API_KEY=your_ipgeolocation_api_key_here
NODE_ENV=production
PORT=8080
EOL
    print_error "Please update the .env file with your actual API keys and run the script again."
fi

print_status "Environment file found"

# Container name
CONTAINER_NAME="atf-backend"

# Stop and remove existing container if it exists
echo "🔄 Stopping existing container..."
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true

# Build the Docker image
echo "🔨 Building Docker image..."
docker build -t atf-backend:latest .

if [ $? -ne 0 ]; then
    print_error "Failed to build Docker image"
fi

print_status "Docker image built successfully"

# Create and start the container
echo "🚀 Starting container..."
docker run -d \
  --name $CONTAINER_NAME \
  --restart unless-stopped \
  -p 8080:8080 \
  atf-backend:latest

if [ $? -ne 0 ]; then
    print_error "Failed to start container"
fi

# Wait a moment for container to start
echo "⏳ Waiting for container to start..."
sleep 10

# Check if container is running
if docker ps | grep -q $CONTAINER_NAME; then
    print_status "Container is running successfully!"
else
    print_error "Container failed to start. Check logs with: docker logs $CONTAINER_NAME"
fi

# Get server IP
SERVER_IP=$(curl -s checkip.amazonaws.com 2>/dev/null || echo "localhost")

# Test API endpoint
echo "🧪 Testing API endpoint..."
sleep 5  # Give a bit more time for the API to be ready

if curl -s -f "http://localhost:8080/api/weather?city=Tokyo" > /dev/null; then
    print_status "API is responding correctly!"
else
    print_warning "API test failed. Check logs with: docker logs $CONTAINER_NAME"
fi

# Show final information
echo ""
echo "🎉 Deployment Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 Backend API: http://${SERVER_IP}:8080"
echo "📋 API Endpoints:"
echo "   • Chat: POST /api/chat"
echo "   • TTS:  POST /api/tts"
echo "   • Weather: GET /api/weather?city=Tokyo"
echo "   • Location: GET /api/location"
echo ""
echo "🔧 Management Commands:"
echo "   • View logs: docker logs -f $CONTAINER_NAME"
echo "   • Stop: docker stop $CONTAINER_NAME"
echo "   • Start: docker start $CONTAINER_NAME"
echo "   • Restart: docker restart $CONTAINER_NAME"
echo "   • Remove: docker stop $CONTAINER_NAME && docker rm $CONTAINER_NAME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
print_status "Simple Docker deployment completed successfully! 🎊"