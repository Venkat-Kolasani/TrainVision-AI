# 🚂 TrainVision AI Decision Support System

A comprehensive railway traffic management and optimization system with AI-powered decision support capabilities, featuring advanced conflict detection, feasibility analysis, and intelligent recommendations.

## 🌐 **LIVE DEMO**
- **🎯 Frontend Application**: https://trainvision.vercel.app/
- **🔧 Backend API**: https://trainvision-ai.onrender.com/
- **📚 API Documentation**: https://trainvision-ai.onrender.com/docs
- **🤖 AI Status**: https://trainvision-ai.onrender.com/ai/status

> **Try it now!** The system is fully deployed and ready to use. Test the ChatBot, explore train schedules, and see AI-powered optimization in action.

## ✨ Features

### Core Functionality
- **Real-time Train Scheduling**: Dynamic optimization using both Greedy and ILP algorithms
- **Interactive Dashboard**: Live visualization of train movements, station status, and system metrics
- **Override Management**: Manual override capabilities with comprehensive impact analysis
- **Conflict Detection**: Advanced conflict detection with detailed explanations and severity assessment
- **Feasibility Analysis**: Pre-override feasibility checking with safety scoring and alternatives
- **AI Recommendations**: Intelligent suggestions for schedule optimization and conflict resolution

### Advanced Features
- **Scenario Simulation**: What-if analysis for delays, breakdowns, weather, and priority changes
- **Analytics Dashboard**: Comprehensive performance metrics and system insights
- **ILP Optimization**: Integer Linear Programming for optimal scheduling (using PuLP/OR-Tools)
- **Real-time Updates**: WebSocket-based live train position tracking
- **Audit Logging**: Complete audit trail of all system actions and decisions

### User Interface
- **Multi-Dashboard Architecture**: Separate dashboards for operations, simulation, and analytics
- **Conflict Visualization**: Real-time conflict indicators with detailed explanations
- **Recommendations Panel**: AI-powered actionable recommendations with impact scoring
- **Interactive Maps**: Enhanced railway network visualization with real-time train positions
- **AI ChatBot**: Conversational interface for system queries and explanations

## 🎯 **Quick Access Links**

| Resource | URL | Description |
|----------|-----|-------------|
| 🎮 **Live Demo** | https://trainvision.vercel.app/ | Full interactive application |
| 🔧 **API Backend** | https://trainvision-ai.onrender.com/ | REST API endpoints |
| 📚 **API Docs** | https://trainvision-ai.onrender.com/docs | Interactive API documentation |
| 🤖 **AI Status** | https://trainvision-ai.onrender.com/ai/status | Gemini AI configuration check |
| 📊 **GitHub Repo** | https://github.com/Venkat-Kolasani/TrainVision-AI | Source code and documentation |

## 🏗️ Architecture

### 🌐 **Production Deployment**
- **Frontend**: React + TypeScript deployed on **Vercel** (https://trainvision.vercel.app/)
- **Backend**: FastAPI deployed on **Render** (https://trainvision-ai.onrender.com/)
- **AI Integration**: Google Gemini 2.5 Flash for intelligent responses
- **Global CDN**: Vercel's edge network for fast worldwide access
- **Auto-scaling**: Render's container orchestration for reliability

### 🔧 **Technical Stack**
- **Backend**: FastAPI-based REST API with WebSocket support
- **Frontend**: React + TypeScript with Tailwind CSS and multi-dashboard architecture
- **Optimization**: 
  - Greedy algorithm with conflict resolution
  - ILP optimization using PuLP and OR-Tools
- **AI Features**: 
  - Conflict detection engine
  - Feasibility analysis system
  - Intelligent recommendations engine powered by Gemini AI
- **Data**: JSON-based train and station datasets with realistic constraints
- **Deployment**: Docker containers optimized for free tier hosting

## 🚀 Quick Start

### 🌐 **Try the Live Demo** (Recommended)
Visit **https://trainvision.vercel.app/** to explore the full system immediately:
- ✅ **No setup required** - fully deployed and configured
- ✅ **AI ChatBot** - ask questions about railway operations
- ✅ **Real-time Optimization** - see conflict detection and resolution
- ✅ **Multiple Dashboards** - operations, simulation, and analytics

### 🛠️ **Local Development Setup**

#### Prerequisites
- Docker and Docker Compose (recommended)
- OR Python 3.8+ and Node.js 16+ for manual setup

#### 🐳 Docker Deployment (Recommended)

**Local Development:**
```bash
# Clone the repository
git clone https://github.com/Venkat-Kolasani/TrainVision-AI.git
cd TrainVision-AI

# Run local deployment script
./scripts/local-deploy.sh

# Edit .env file with your Gemini API key
# Get your key from: https://makersuite.google.com/app/apikey
```

**Production Deployment:**
```bash
# Copy and configure production environment
cp .env.production.example .env.production
# Edit .env.production with your production values

# Deploy to production
./deploy.sh
```

### 🔧 Manual Setup (Alternative)

#### Backend Setup
```bash
cd backend
pip install -r requirements.txt

# Configure Gemini AI
cp .env.example .env
# Edit .env and add your Gemini API key

python main.py
```

#### Frontend Setup
```bash
cd rail-frontend
npm install
npm run dev
```

### 🌐 Access the Application

#### Docker Deployment
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

#### Manual Setup
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## 📊 Dashboard Overview

### 1. Main Dashboard
- Real-time train scheduling and visualization
- Manual override capabilities with feasibility checking
- Live conflict detection and resolution
- Interactive railway network map

### 2. Simulation Dashboard
- Scenario testing (delays, breakdowns, weather, priority changes)
- Before/after impact analysis
- Recommended actions for each scenario
- Scenario history and comparison

### 3. Analytics Dashboard
- System performance metrics and KPIs
- Delay analysis by station and train type
- Platform utilization statistics
- Conflict analysis and trends
- Optimizer settings configuration

## 🔧 API Endpoints

### Core Operations
- `GET /trains` - Get all trains
- `GET /schedule` - Get optimized schedule with conflicts
- `POST /override` - Apply manual override
- `GET /stations` - Get station information

### Advanced Features
- `POST /feasibility` - Check override feasibility
- `GET /conflicts` - Get current conflicts with explanations
- `GET /recommendations` - Get AI recommendations
- `POST /apply-recommendation` - Apply a specific recommendation

### Simulation
- `POST /simulate/delay` - Simulate delay scenario
- `POST /simulate/breakdown` - Simulate breakdown scenario
- `POST /simulate/weather` - Simulate weather impact
- `POST /simulate/priority` - Simulate priority changes
- `GET /scenarios` - Get simulation history

### Analytics & Settings
- `GET /analytics/summary` - Get comprehensive analytics
- `GET /settings/optimizer` - Get optimizer settings
- `POST /settings/optimizer` - Update optimizer settings

### Real-time Features
- `WebSocket /ws` - Real-time train positions and updates
- `GET /train-positions` - Current train positions
- `GET /track-status` - Track occupancy and conflicts

### AI Integration (Gemini)
- `POST /ai/analyze-schedule` - AI-powered schedule analysis and optimization suggestions
- `GET /ai/status` - Check Gemini AI configuration status

## 🤖 AI Features

### Conflict Detection
- **Platform Overlap**: Detects trains assigned to same platform with overlapping times
- **Headway Violations**: Identifies insufficient time between consecutive trains
- **Priority Conflicts**: Flags cases where lower priority trains precede higher priority ones
- **Severity Assessment**: Categorizes conflicts as low, medium, high, or critical

### Feasibility Analysis
- **Safety Scoring**: Evaluates safety implications of proposed overrides
- **Impact Assessment**: Quantifies effects on delays and affected trains
- **Alternative Generation**: Suggests better platform assignments
- **Risk Analysis**: Provides detailed reasoning for approval/rejection

### Intelligent Recommendations
- **Conflict Resolution**: Automated suggestions to resolve detected conflicts
- **Optimization Opportunities**: Proactive recommendations for schedule improvement
- **Cost-Benefit Analysis**: Scoring system based on delay reduction and conflict resolution
- **Impact Prediction**: Forecasts effects of recommended actions

### Gemini AI Integration
- **Schedule Analysis**: AI-powered analysis of current train schedules using Google's Gemini 2.5 Flash model
- **Live ChatBot**: Interactive AI assistant available at https://trainvision.vercel.app/
- **Optimization Suggestions**: Natural language recommendations for improving railway operations
- **Interactive Queries**: Ask specific questions about schedule optimization and get AI-powered insights
- **Real-time Insights**: Contextual analysis based on current system state and conflicts
- **Production Ready**: Fully configured and operational in the live deployment

## 🧮 Advanced Optimization Algorithms

TrainVision AI employs sophisticated algorithms for train scheduling, conflict resolution, and railway throughput optimization:

### 🚀 Greedy Algorithm (Real-time Optimization)
**Purpose**: Real-time train scheduling with conflict resolution
- **Time Complexity**: O(n log n) for n trains
- **Execution Speed**: Sub-second optimization for immediate decisions
- **Features**:
  - Priority-based train sorting (Express > Local > Freight)
  - Dynamic platform assignment with conflict avoidance
  - Automatic delay injection for conflict resolution
  - Manual override integration with impact analysis
- **Use Case**: Live operations requiring immediate scheduling decisions

### 🎯 Integer Linear Programming (ILP) - Optimal Solutions
**Purpose**: Mathematical optimization for maximum railway throughput
- **Solver**: PuLP with CBC backend for optimal solutions
- **Objective Function**: `minimize(Σ delays + Σ conflict_penalties)`
- **Constraints**:
  - Platform capacity constraints (no overlapping assignments)
  - Minimum headway requirements (5-minute safety buffer)
  - Fixed platform assignments (controller overrides)
  - Train assignment uniqueness
- **Features**:
  - Configurable objectives (minimize delays/conflicts/balanced)
  - Time-bounded optimization (adjustable solver limits)
  - Handles complex multi-constraint scenarios
- **Use Case**: Strategic planning and optimal resource utilization

### 🔍 Conflict Detection & Resolution Engine
**Purpose**: Proactive conflict identification and automated resolution
- **Algorithm**: Multi-pass conflict detection with severity scoring
- **Conflict Types**:
  - **Platform Overlap**: Same platform, overlapping time windows
  - **Headway Violations**: Insufficient safety margins (<5 minutes)
  - **Priority Conflicts**: Lower priority trains blocking higher priority
- **Resolution Strategies**:
  - Platform reassignment optimization
  - Temporal delay injection with minimal impact
  - Priority-based train reordering
- **Performance**: Real-time conflict detection with <100ms response

### 🤖 AI-Powered Throughput Optimization
**Purpose**: Intelligent recommendations for system-wide efficiency
- **Engine**: Google Gemini 2.5 Flash with railway domain expertise
- **Optimization Targets**:
  - **Throughput Maximization**: Optimal train-per-hour ratios
  - **Delay Minimization**: Predictive delay prevention
  - **Resource Utilization**: Platform and track efficiency optimization
- **Features**:
  - Predictive conflict analysis
  - Cost-benefit scoring for recommendations
  - Multi-objective optimization balancing
  - Real-time adaptation to system changes

### 📊 Performance Optimization Metrics
- **Throughput**: Trains processed per hour per platform
- **Efficiency**: Platform utilization percentage (target: 80-90%)
- **Reliability**: On-time performance (target: >95% within 2 minutes)
- **Conflict Resolution**: Average resolution time <30 seconds

## 📈 Performance Metrics

The system tracks and displays:
- **On-time Performance**: Percentage of trains arriving within 2 minutes of schedule
- **Average Delays**: Mean delay across all trains
- **Conflict Statistics**: Count and severity of scheduling conflicts
- **Platform Utilization**: Usage statistics for each platform
- **System Efficiency**: Overall optimization effectiveness

## 🗃️ Dataset

The system uses a realistic dataset featuring:
- **Stations**: Hyderabad network (HYB, SC, KCG) with varying platform counts
- **Train Types**: Express, Local, Intercity, and Freight with different priorities
- **Realistic Constraints**: Platform preferences, dwell times, and operational rules
- **Dynamic Scenarios**: Support for delays, breakdowns, and priority changes

## 🛠️ Development

### Project Structure
```
TrainVision-AI-Decision-Support/
├── backend/
│   ├── main.py                 # Main FastAPI application
│   ├── models.py              # Data models and schemas
│   ├── optimizer.py           # Greedy optimization algorithms
│   ├── ilp_optimizer.py       # ILP optimization engine
│   ├── conflict_detector.py   # Conflict detection system
│   ├── recommendations.py     # AI recommendations engine
│   └── requirements.txt       # Python dependencies
├── rail-frontend/
│   ├── src/
│   │   ├── App.tsx            # Original main dashboard
│   │   ├── AppWithDashboards.tsx  # Multi-dashboard wrapper
│   │   └── components/
│   │       ├── SimulationDashboard.tsx
│   │       ├── AnalyticsDashboard.tsx
│   │       └── ChatBot.tsx
│   └── package.json           # Node.js dependencies
└── README.md
```

### Key Technologies
- **Backend**: FastAPI, Pydantic, WebSockets, PuLP, OR-Tools
- **Frontend**: React, TypeScript, Tailwind CSS, Lucide React
- **Optimization**: Linear Programming, Constraint Satisfaction
- **Real-time**: WebSocket communication, Live updates

## 🚦 Usage Examples

### Running a Simulation
1. Navigate to the Simulation Dashboard
2. Select scenario type (delay, breakdown, weather, priority)
3. Choose affected train(s) and parameters
4. Run simulation to see predicted impact
5. Review recommendations and apply if needed

### Applying Manual Overrides
1. In the Main Dashboard, select a train
2. Choose new platform assignment
3. System automatically checks feasibility
4. Review safety score and impact analysis
5. Apply override if acceptable or choose alternatives

### Monitoring System Performance
1. Access the Analytics Dashboard
2. Review KPIs and performance metrics
3. Analyze delay patterns by station/train type
4. Monitor conflict trends and resolution effectiveness
5. Adjust optimizer settings as needed

## 🚀 Production Deployment

### 🌐 **Current Live Deployment**

**✅ DEPLOYED AND RUNNING:**
- **Frontend**: https://trainvision.vercel.app/ (Vercel)
- **Backend**: https://trainvision-ai.onrender.com/ (Render)
- **Status**: Fully operational with AI integration
- **Uptime**: 24/7 availability on free tiers

### 📊 **Deployment Details**

#### **Frontend (Vercel)**
- **Platform**: Vercel (Global CDN)
- **Build**: Vite + React + TypeScript
- **Performance**: <100ms response time globally
- **Auto-deployment**: On every git push to main

#### **Backend (Render)**
- **Platform**: Render (Container hosting)
- **Runtime**: Python 3.11 + FastAPI + Gunicorn
- **AI**: Google Gemini 2.5 Flash integration
- **Optimization**: Single worker, memory-optimized for free tier

### 🔧 **Alternative Deployment Options**

The application is containerized and ready for deployment on:
- **AWS ECS/Fargate**
- **Google Cloud Run**
- **Azure Container Instances**
- **DigitalOcean App Platform**
- **Fly.io** (configuration included)

#### **Environment Variables for Production**
```bash
# Required environment variables
GEMINI_API_KEY=your_production_api_key
GEMINI_MODEL=gemini-2.5-flash
FRONTEND_URL=https://trainvision.vercel.app
BACKEND_URL=https://trainvision-ai.onrender.com
```

### 🔒 Security Considerations
- ✅ CORS properly configured for production domains
- ✅ Environment variables for sensitive data
- ✅ Health checks implemented
- ✅ Non-root user in Docker containers
- ✅ Security headers in nginx configuration
- ⚠️ Add HTTPS/SSL certificates for production
- ⚠️ Consider adding authentication for production use

### 📊 Monitoring & Logging
- **Health check endpoints**: `/ai/status`, `/health`
- **Live monitoring**: https://trainvision-ai.onrender.com/ai/status
- **Application logs**: Available via Render dashboard
- **Performance**: Optimized for free tier limitations

## 🧪 **Testing the Live System**

### **Frontend Testing** (https://trainvision.vercel.app/)
1. **Dashboard Navigation**: Switch between Main, Simulation, and Analytics dashboards
2. **Train Management**: View 6 active trains across HYB, SC, KCG stations
3. **AI ChatBot**: Click the bot icon and ask:
   - "How many trains are available?"
   - "What's happening at HYB station?"
   - "Explain the optimization process"
4. **Manual Overrides**: Try changing train platform assignments
5. **Conflict Resolution**: Watch automatic conflict detection and resolution

### **Backend API Testing** (https://trainvision-ai.onrender.com/)
- **API Documentation**: https://trainvision-ai.onrender.com/docs
- **Health Check**: `GET /ai/status`
- **Train Data**: `GET /trains`
- **Schedule**: `GET /schedule`
- **AI Analysis**: `POST /ai/analyze-schedule`

### **Performance Notes**
- **First Load**: May take 30-60 seconds (free tier cold start)
- **Subsequent Requests**: <2 seconds response time
- **AI Responses**: 3-10 seconds depending on query complexity

## 📚 Documentation

For comprehensive technical documentation, including system architecture, algorithms, API reference, and development guide, see:

**[📖 Complete Technical Documentation](./documentation.md)**

The documentation covers:
- **System Architecture**: Detailed technical overview and component interactions
- **Core Algorithms**: Greedy optimization, ILP solver, conflict detection, and AI recommendations
- **API Reference**: Complete endpoint documentation with examples
- **Data Models**: Comprehensive schema and data structure documentation
- **Frontend Components**: React component architecture and state management
- **AI Integration**: Gemini AI implementation and use cases
- **Deployment Guide**: Production deployment on Vercel and Render
- **Development Setup**: Local development environment and contribution guidelines

## 🤝 Contributing

This system demonstrates advanced railway optimization concepts and can be extended with:
- Additional optimization algorithms
- More sophisticated AI models
- Integration with real railway systems
- Enhanced visualization capabilities
- Mobile applications for field operations

Please refer to the [technical documentation](./documentation.md) for detailed development guidelines and system architecture.

## 📄 License

This project is a demonstration system for educational and research purposes.

---

**TrainVision AI** - Intelligent Railway Traffic Management System
