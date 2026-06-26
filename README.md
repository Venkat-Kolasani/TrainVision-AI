# TrainVision AI Decision Support System [ SIH25022 ]

A railway **operations control center (OCC)** demo for the Hyderabad corridor (**HYB → SC → KCG**). Controllers monitor live trains, resolve platform conflicts, run what-if simulations, and review performance analytics—with optional AI assistance.

## What this website does (in plain terms)

TrainVision AI is **not** a ticketing or passenger app. It helps a **railway controller** answer:

| Question | Where in the app |
|----------|------------------|
| Where are my trains right now? | **Operations** → network map + platform board |
| Are any platforms double-booked? | **Operations** → alerts, conflict badges on schedule |
| Can I move train X to platform Y safely? | **Operations** → select train → manual override (feasibility check) |
| What happens if train T is delayed 15 minutes? | **Simulation** → run delay scenario, compare graphs |
| How are we performing over time? | **Analytics** → KPIs, trends, station delay heatmap |
| Why did the system make this decision? | **Activity** tab + AI chatbot |

**Data flow (simplified):** train/station JSON → optimizer assigns platforms & times → conflict detector flags overlaps → UI polls API every 5s + WebSocket for live positions → controller can override or simulate changes.

**Live demo:** [trainvision.vercel.app](https://trainvision.vercel.app/) · API docs: [trainvision-ai.onrender.com/docs](https://trainvision-ai.onrender.com/docs)

## Live Demo
- **Frontend Application**: https://trainvision.vercel.app/
- **Backend API**: https://trainvision-ai.onrender.com/
- **API Documentation**: https://trainvision-ai.onrender.com/docs
- **AI Status**: https://trainvision-ai.onrender.com/ai/status
- **Health (Redis status)**: https://trainvision-ai.onrender.com/health

## Features

### Command Center (Operations) — Phase 3C
- **Conflict-aware schedule** — rows involved in active conflicts show a conflict badge; filter by conflict status
- **Map click-through** — click a train on the map to open the train detail drawer
- **Track link coloring** — inter-station links reflect `/track-status` occupancy
- **Train graph live markers** — WebSocket position “head” on the active leg in timeline view
- **Optimizer reliability** — greedy scheduler force-assigns legs at max delay (no dropped trains)
- **Analytics fix** — trends heatmap + KPI charts; 5-minute trend buckets on the backend

### Command Center (Operations) — Phase 3B
- **Unified live feed** — Single `OperationsFeedProvider` polls schedule, conflicts, track status, and recommendations (no duplicate 3s/10s fetches)
- **Train graph** — Occupation diagram with NOW line, baseline overlay, conflict hatch, corridor/compare modes
- **Platform board** — Now/next grid per station platform; click-through to train drawer
- **Alert queue** — Sortable triage with ack states; live situational **Context strip**
- **Track occupancy** — `/track-status` wired in operations rail
- **Selection workflow** — Manual override targets selected train (not `schedule[0]`)
- **15-train corridor** — Multi-leg scheduling for through trains (HYB↔SC↔KCG)
- **KPI trends** — `/analytics/trends` ring buffer with line charts in Analytics

### Command Center (Operations) — Phase 3A
- **Wall-display mode** — Press `F` or use **Command center** in the toolbar for fullscreen monitoring
- **Status board** — Trains, on-time %, conflicts, average delay at a glance
- **Tabbed workspace** — Schedule, Timeline (Gantt), and Activity (audit log)
- **Operator actions only** — Manual override and clear delays on Operations; diagnostics live in Simulation

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
- **Real-time Updates**: WebSocket train positions; optional Redis pub/sub for multi-worker fan-out on Render
- **Audit Logging**: Complete audit trail of all system actions and decisions

### User Interface
- **Multi-Dashboard Architecture**: Separate dashboards for operations, simulation, and analytics
- **Conflict Visualization**: Real-time conflict indicators with detailed explanations
- **Recommendations Panel**: AI-powered actionable recommendations with impact scoring
- **Interactive Maps**: Enhanced railway network visualization with real-time train positions
- **AI ChatBot**: Conversational interface for system queries and explanations

### Accessibility
Keyboard shortcuts (`F`, `Esc`, `R`), skip link, `aria-live` alerts, and reduced-motion support. See [rail-frontend/ACCESSIBILITY.md](rail-frontend/ACCESSIBILITY.md).

## Architecture

### Production Deployment
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

Optional Redis for multi-worker WebSocket testing:

```bash
# From repo root
docker compose up -d redis
export REDIS_URL=redis://localhost:6379/0
```

#### Frontend Setup
```bash
cd rail-frontend
cp .env.example .env.local
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

## Dashboard Overview

### 1. Operations (Command Center)
- Network map with live train positions and status board
- Command Center fullscreen (`F`) for wall-display monitoring
- Tabbed Schedule, Timeline, and Activity workspace
- Manual override and clear delays (operator actions only)

### 2. Simulation
- Uses the **same live feed** as Operations for baseline schedule (no duplicate polling)
- Scenario testing (delays, breakdowns, weather, priority changes)
- Side-by-side KPI + dual train graphs when comparing two scenarios
- Diff-highlighted schedule table vs live baseline
- **Promote to live** applies top recommendation (with confirmation)

### 3. Analytics Dashboard
- KPI cards, delay charts, platform utilization, conflict breakdown
- **Live ops hints** from unified feed (conflicts + active delays)
- **KPI trends** line chart (5-minute buckets via `/analytics/trends`)
- **Station delay heatmap** across recent trend snapshots
- Optimizer settings (greedy vs ILP)

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
- `GET /analytics/summary` - Get comprehensive analytics (also records a trend bucket)
- `GET /analytics/trends` - Time-series KPI snapshots (5-minute buckets)
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

### Project structure (where to look in the code)

```
TrainVision-AI/
├── backend/
│   ├── main.py              # FastAPI app: all REST + WebSocket routes
│   ├── optimizer.py         # Greedy multi-leg scheduler (force-assign at max delay)
│   ├── ilp_optimizer.py     # Optional ILP solver (PuLP / OR-Tools)
│   ├── conflict_detector.py # Platform overlap, headway, priority conflicts
│   ├── schedule_service.py  # Schedule recompute + read-only GET payload
│   ├── train_legs.py        # Multi-station leg expansion per train
│   ├── analytics_trends.py  # In-memory 5-min KPI trend buckets
│   ├── data/                # prototype_trains.json (15 trains, 3 stations)
│   ├── tests/               # pytest: optimizers, API, override, simulation
│   └── requirements-dev.txt # CI/test deps (no optional Gemini package)
├── rail-frontend/src/
│   ├── AppWithDashboards.tsx    # Top nav: Operations | Simulation | Analytics
│   ├── App.tsx                  # Operations OCC layout
│   ├── context/
│   │   ├── OperationsFeedContext.tsx  # Unified 5s poll + WebSocket
│   │   └── SelectionContext.tsx       # Selected train for drawer/override
│   └── components/
│       ├── operations/          # Map, schedule table, train graph, alerts…
│       ├── SimulationDashboard.tsx
│       └── AnalyticsDashboard.tsx
├── documentation.md           # Full technical reference (start here for depth)
├── TESTING.md                 # How to run pytest / vitest / smoke scripts
└── .github/workflows/ci.yml   # CI: backend pytest + frontend test + build
```

### Key frontend concepts

| Concept | File | Purpose |
|---------|------|---------|
| Unified feed | `OperationsFeedContext.tsx` | One poll loop for schedule, conflicts, track status, positions |
| Selection | `SelectionContext.tsx` | Which train/leg is open in the drawer |
| Train graph | `operations/TrainGraph.tsx` | Time × platform occupation diagram |
| Schedule status | `lib/scheduleUtils.ts` | on-time / delayed / overridden / **conflict** |

### Key backend concepts

| Concept | File | Purpose |
|---------|------|---------|
| Schedule state | `main.py` + `schedule_service.py` | In-memory schedule; `GET /schedule` is read-only |
| Multi-leg | `train_legs.py` | Through trains visit HYB, SC, KCG in order |
| Trends | `analytics_trends.py` | Deduped snapshots when `/analytics/summary` is called |

### Project Structure (legacy tree)
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

## 🧪 **Testing**

See [TESTING.md](TESTING.md) for local commands:

```bash
./scripts/test-backend.sh    # pytest: optimizers + API + override/feasibility/simulation
cd rail-frontend && npm run test && npm run build
./scripts/e2e-smoke.sh       # API smoke + vitest (backend must be running)
```

CI runs the same checks on every push/PR via `.github/workflows/ci.yml`.

## 🧪 **Testing the Live System**

### **Frontend Testing** (https://trainvision.vercel.app/)
1. **Dashboard Navigation**: Switch between Main, Simulation, and Analytics dashboards
2. **Train Management**: View 15 active trains across HYB, SC, KCG stations
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

| Document | Audience | Contents |
|----------|----------|----------|
| **[README.md](./README.md)** | Everyone | What the app does, quick start, feature list |
| **[documentation.md](./documentation.md)** | Developers | Architecture, algorithms, API, component map |
| **[TESTING.md](./TESTING.md)** | Contributors | pytest, vitest, manual OCC checklist |

**[📖 Complete Technical Documentation](./documentation.md)** — system architecture, greedy/ILP algorithms, API reference, frontend component guide, deployment.

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
