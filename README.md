# Aetheria Backend

A Node.js Express backend service that provides intelligent weather information through a conversational AI interface. The system integrates multiple APIs including Google's Gemini AI, Google Cloud Speech-to-Text, Text-to-Speech, and weather services to deliver contextual weather responses.

> ## ⭐ Key Highlight: Architected for Zero-Cost Development & Evaluation
>
> This project was strategically designed to be fully functional for development and evaluation without incurring any cloud costs. This was achieved through two key decisions:
>
> 1.  **Free Generative AI Core:** The most resource-intensive component, the Gemini language model, is integrated via the **free developer API from Google AI Studio**. This provides state-of-the-art AI capabilities without requiring a billed Google Cloud account.
>
> 2.  **Free-Tier Cloud Services:** The Speech-to-Text and Text-to-Speech functionalities utilize a standard Google Cloud project, but are engineered to operate comfortably within the **generous free tier**.
>
> **The result is a powerful, full-featured AI application that can be cloned, tested, and evaluated thoroughly at zero expense.**

## Purpose and Use Case
This project is an AI-powered conversational assistant designed for individuals planning activities. It provides weather-aware, themed suggestions for things to do, accessible via voice in both Japanese and English.

The primary use case is to offer users a hands-free, interactive way to get creative and practical ideas tailored to their interests and the current weather conditions.

**Target Users:**

-   **Travelers and Tourists:** Looking for unique, location-specific activities.
-   **Hobbyists:** Seeking recommendations for interests like photography, sports, or dining.
-   **Locals:** Exploring new places and activities in their own city.

## Architecture Overview
This backend serves as the core processing engine for an AI-powered weather assistant that can:

-   Process natural language queries about weather conditions
-   Handle voice input through speech-to-text conversion
-   Generate intelligent responses using Google's Gemini AI
-   Provide text-to-speech audio responses
-   Maintain conversation context using in-memory storage (no external database required)
-   Detect user location automatically
-   Support multilingual interactions

### In-Memory Context Management
This system is designed with zero external database dependencies. All conversation context, session data, and user preferences are stored entirely in memory using JavaScript Map objects. This approach provides:

-   **Ultra-fast response times:** No database queries or I/O operations
-   **Simplified deployment:** No database setup, configuration, or maintenance required
-   **Simplified Scaling:** Can be scaled with session affinity (sticky sessions) without a shared database.
-   **Automatic cleanup:** Inactive sessions are automatically purged after 30 minutes
-   **Development simplicity:** No database migrations, schemas, or ORM configurations

The in-memory storage handles:

-   Conversation history (limited to last 4 exchanges per session)
-   User preferences and themes
-   Current location context
-   Session timestamps for automatic cleanup

## Core Features
### Intelligent Conversation Processing
-   **Natural Language Understanding:** Processes complex weather queries in conversational format
-   **In-Memory Context Management:** Maintains session-based conversation history and user preferences using JavaScript Map storage - no external database required
-   **Location Intelligence:** Automatically detects and remembers user locations from conversation context
-   **Multi-turn Conversations:** Supports follow-up questions and contextual responses
-   **Automatic Session Cleanup:** Inactive sessions are automatically removed after 30 minutes to prevent memory leaks

### Voice Integration
-   **Speech-to-Text:** Converts audio input to text using Google Cloud Speech API
-   **Text-to-Speech:** Generates natural-sounding audio responses with language detection
-   **Multilingual Support:** Handles both English and Japanese language processing

### Weather Data Services
-   **Real-time Weather:** Current conditions, forecasts, and detailed weather information
-   **Location Services:** IP-based location detection and geographic coordinate handling
-   **Flexible Querying:** Supports city names, coordinates, and contextual location references

### Session Management
-   **In-Memory Sessions:** All session data stored in JavaScript Map objects - no database setup required
-   **Persistent Context:** Maintains user context and conversation history during active sessions
-   **Automatic Cleanup:** Removes inactive sessions after 30 minutes to optimize memory usage
-   **Theme Support:** Allows users to customize conversation themes
-   **Zero Database Dependencies:** Complete functionality without external database infrastructure

## API Endpoints
### Chat Endpoint
**POST /api/chat**
Main conversational interface supporting both text and audio input.

**Request Formats:**

-   JSON: `{ "text": "What's the weather like?", "sessionId": "user123" }`
-   FormData: `audio` (file) + `sessionId` (text field)

### Weather Data
**GET /api/weather?city=Tokyo**
Direct weather data retrieval for specific locations.

### Location Detection
**GET /api/location**
Automatic user location detection based on IP address.

### Text-to-Speech
**POST /api/tts**
Converts text responses to audio with automatic language detection.

**Request Options:**

-   Single language: `{ "text": "Hello", "language": "english" }`
-   Auto-detect: `{ "text": "こんにちは" }`
-   Bilingual: `{ "mode": "both", "japaneseText": "こんにちは", "englishText": "Hello" }`

### Debug Endpoints
**GET /api/debug/session/:sessionId**
Development endpoint for inspecting session state and conversation history.

## Technology Stack
### Core Framework
-   **Node.js:** Runtime environment
-   **Express.js:** Web application framework
-   **CORS:** Cross-origin resource sharing configuration

### AI and ML Services
-   **Google Generative AI:** Gemini 2.5 Flash Lite for natural language processing
-   **Google Cloud Speech-to-Text:** Audio transcription services
-   **Google Cloud Text-to-Speech:** Audio synthesis

### External APIs
-   **WeatherAPI:** Real-time weather data
-   **IP-API.com:** Location detection services

### Data Processing
-   **Multer:** File upload handling for audio files
-   **FFmpeg:** Audio processing and format conversion
-   **Axios:** HTTP client for external API communications
-   **In-Memory Storage:** JavaScript Map objects for session and context management (no external database)

## Environment Configuration
### Required Environment Variables
```
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_APPLICATION_CREDENTIALS_BASE64=base64_encoded_service_account
WEATHER_API_KEY=your_weatherapi_key
NODE_ENV=production
PORT=8080
```
### API Key Instructions

*   **`GEMINI_API_KEY`**: Get a **free API key** instantly from **[Google AI Studio](https://aistudio.google.com/)**. This does not require a billed GCP account.

*   **`GOOGLE_APPLICATION_CREDENTIALS_BASE64`**: This requires a standard Google Cloud project for the Speech-to-Text and Text-to-Speech services. The project's usage will remain within the free tier during evaluation.

### Service Account Setup
The Google Cloud services require a service account with the following permissions:

-   Cloud Speech-to-Text API access
-   Cloud Text-to-Speech API access

Encode your service account JSON file to base64 and set as `GOOGLE_APPLICATION_CREDENTIALS_BASE64`.

## Deployment
### Docker Deployment (Recommended)
**Build and Run**
```bash
# Build the Docker image
docker build -t atf-backend:latest .

# Run the container
docker run -d \
  --name atf-backend \
  --restart unless-stopped \
  -p 8080:8080 \
  --env-file .env \
  atf-backend:latest
```
**Using Deployment Script**
```bash
# Automated deployment
./deploy-simple.sh
```
### AWS EC2 Deployment
1.  Launch Ubuntu 22.04 LTS instance (t3.small recommended)
2.  Configure security groups for ports 22, 80, 443, and 8080
3.  Install Docker.
4.  Deploy using the included `deploy-simple.sh` script.

### Local Development
```bash
# Install dependencies
npm install

# Start development server
node server.js
```
## Performance and Scalability
### Resource Requirements
-   **Minimum:** 1GB RAM, 1 vCPU
-   **Recommended:** 2GB RAM, 2 vCPU for production workloads
-   **Storage:** 20GB for container images and logs

### Optimization Features
-   **In-Memory Architecture:** Zero database overhead provides ultra-fast response times
-   **Automatic Session Cleanup:** Prevents memory leaks by removing inactive sessions after 30 minutes
-   **Efficient API Usage:** Leverages efficient connection handling for external API calls.
-   **Error Handling:** Structured error recovery and logging within API routes
-   **Memory Management:** Conversation history limited to 4 exchanges per session to control memory usage

### Monitoring and Health Checks
-   **Health Check Endpoint:** Built-in health monitoring at root path via `healthcheck.js`
-   **Docker Health Checks:** Container-level health monitoring
-   **Logging:** Console-based logging for debugging and monitoring

## Security Considerations
### API Security
-   **CORS Configuration:** Properly configured origin restrictions
-   **Environment Variables:** Secure handling of API keys and credentials
-   **Input Validation:** Basic checks for required inputs and secure file upload handling via `multer`.

### Deployment Security
-   **Non-root Container:** Docker container runs with non-privileged user
-   **Minimal Attack Surface:** Alpine Linux base image with only required dependencies
-   **Secure Defaults:** Production-ready security configurations

## Integration Guidelines
### Frontend Integration
The backend is designed to work with modern frontend frameworks through RESTful APIs. CORS is configured for:

-   Production frontend: `https://aetheria-atf-miit.vercel.app`
-   Local development: `http://localhost:3000`, `http://localhost:3001`, and `http://127.0.0.1:3000`

### Mobile Applications
All endpoints support standard HTTP methods and can be integrated with mobile applications using standard REST client libraries.

### Third-party Integrations
The modular service architecture allows easy integration of additional weather providers, AI services, or communication channels.

## Development Guidelines
### Code Structure
```
backend/
├── controllers/     # Request handling and response formatting
├── services/        # External API integrations and business logic
├── routes/         # API endpoint definitions
├── utils/          # Helper functions and utilities
├── server.js       # Application entry point
└── Dockerfile      # Container configuration
```
### Adding New Features
1.  Implement service layer functions in `services/`
2.  Create controller methods in `controllers/`
3.  Define new routes in `routes/api.routes.js`

### Error Handling
The application implements structured error handling:

-   Service-level error catching and logging
-   Graceful degradation for external API failures
-   User-friendly error messages in API responses

## Support and Maintenance
### Logging and Debugging
-   Console-based logging for development
-   Detailed error reporting in logs
-   Debug endpoint for session inspection
-   Container log aggregation support

### Updates and Patches
-   **Docker-based deployment enables easy updates.**
-   **Simplified Updates:** The Docker-based workflow allows for quick and simple stop-and-replace deployments.
-   **Database-free architecture simplifies maintenance** and eliminates database migration concerns.

### Monitoring Recommendations
-   Implement external monitoring for API endpoint availability
-   Monitor external API quota usage
-   Track session cleanup efficiency
-   Monitor container resource utilization

## License and Compliance
This software integrates with several third-party APIs and services. Ensure compliance with:

-   Google Cloud Platform Terms of Service
-   WeatherAPI Terms of Service
-   IP-API.com Terms of Service

Review and maintain appropriate API key restrictions and usage monitoring.

## Version Information
-   **Current Version:** 1.0.0
-   **Node.js Version:** 18.x LTS
-   **API Version:** v1