# NovaTask — Next-Gen Agile Task & Workflow Intelligence Platform

NovaTask is an advanced, production-grade full-stack task management web application built to elevate personal and team productivity. It goes far beyond standard tutorial apps by integrating a **solid Node.js/Express backend**, **real-time WebSocket synchronization (Socket.io)**, **native SQLite persistence**, **JWT authentication & authorization**, **interactive drag-and-drop Kanban execution**, **subtask checklists with progress tracking**, and a **productivity analytics dashboard**.

---

## 🌟 What Makes NovaTask Different (vs. The Tutorial Video)

| Feature | YouTube Tutorial (TaskBuddy) | NovaTask Platform |
| :--- | :--- | :--- |
| **Backend Architecture** | ❌ None (Local browser state only) | ✅ **Production Express 4 backend** with SQLite & REST API |
| **Persistence** | ⚠️ In-memory / temporary | ✅ **Persistent SQLite Database** (Built-in Node 24 native engine) |
| **Authentication** | ❌ No authentication | ✅ **JWT authentication, bcryptjs encryption, profile management & 1-click demo access** |
| **Real-time Sync** | ❌ No synchronization | ✅ **Bi-directional WebSockets (Socket.io)** updating all connected clients live |
| **Kanban Board** | ❌ Basic list only | ✅ **Native HTML5 drag-and-drop Kanban** (To Do, In Progress, Review, Completed) |
| **Subtask Breakdown** | ❌ Single task title only | ✅ **Interactive subtask checklists** with live progress rings & % calculations |
| **Views** | ❌ Single static view | ✅ **Triple Views**: Kanban Board, Structured Table List, and Analytics Dashboard |
| **Analytics & Metrics** | ⚠️ Basic count | ✅ **SVG Completion Gauge, overdue alerts, priority breakdown & category distribution** |
| **Audit Stream** | ❌ None | ✅ **Real-time team activity feed** logging every change and milestone |
| **Data Export** | ❌ None | ✅ **One-click CSV and JSON data export** |
| **Aesthetic / Theme** | ⚠️ Basic CSS | ✅ **Dark / Light mode** with glassmorphic tokens, glowing badges, and custom icons |

---

## 🏗️ System Architecture

```
novatask/
├── server/                      # Solid Express.js Backend
│   ├── src/
│   │   ├── db.js                # Native Node 24 SQLite schema, seeding & activity logger
│   │   ├── server.js            # Express server + Socket.io WebSocket attachment
│   │   ├── middleware/
│   │   │   └── auth.js          # JWT Bearer token authentication middleware
│   │   └── routes/
│   │       ├── auth.js          # Signup, Login, Demo Access, Profile routes
│   │       ├── tasks.js         # Full CRUD, Drag Status, Subtasks, Analytics & Export
│   │       └── activities.js    # Team activity audit trail stream
│   ├── novatask.db              # SQLite Database file
│   └── package.json
│
├── client/                      # Modern React + Vite Frontend
│   ├── src/
│   │   ├── context/
│   │   │   ├── AuthContext.jsx  # User session, JWT token state, profile management
│   │   │   └── SocketContext.jsx# Live WebSocket connection and presence indicators
│   │   ├── services/
│   │   │   └── api.js           # Fetch wrapper with auto-auth and error interceptors
│   │   ├── components/
│   │   │   ├── Navbar.jsx       # Brand, view switcher, live status, quick actions
│   │   │   ├── HeroBanner.jsx   # Dynamic greeting, quick metrics, search & filters
│   │   │   ├── KanbanBoard.jsx  # 4-stage drag-and-drop workflow columns
│   │   │   ├── TaskCard.jsx     # Priority badges, tags, subtask toggle, due date
│   │   │   ├── TaskListView.jsx # Table/List view with quick completion toggles
│   │   │   ├── AnalyticsDashboard.jsx # SVG dial, priority histogram, velocity stats
│   │   │   ├── TaskModal.jsx    # Create/edit task with subtask builder & tags
│   │   │   ├── AuthModal.jsx    # Sign in, Sign up, and instant 1-click Demo buttons
│   │   │   ├── ProfileModal.jsx # Avatar picker & user title editor
│   │   │   ├── ActivityDrawer.jsx # Slide-out live activity history stream
│   │   │   └── ToastContainer.jsx # Floating alerts for live sync and actions
│   │   ├── index.css            # Glassmorphic tokens, animations, responsive rules
│   │   └── App.jsx
│   └── package.json
│
├── package.json                 # Monorepo root runner
└── README.md
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20+ or v24+ (Node 24 includes the built-in native SQLite engine `node:sqlite`).

### 2. Live Running Instances
The application is currently active on your local machine:
- **Frontend Web UI**: [http://localhost:5173](http://localhost:5173)
- **Backend API & WebSocket Engine**: [http://localhost:5000](http://localhost:5000)

### 3. How to Launch Later
To start both backend and frontend concurrently in a single terminal:
```bash
cd C:\Users\anant\.gemini\antigravity\scratch\novatask
npm run dev
```

Or run them individually:
```bash
# Terminal 1: Backend Server
cd server
npm start

# Terminal 2: Frontend Client
cd client
npm run dev
```

---

## 🔑 Demo Accounts (Pre-configured)

You can click the **"Demo User"** button in the header or in the Sign In modal for instant one-click login:
- **Alex Rivera** (Product Lead): `alex@novatask.io` / `Password123!`
- **Sarah Chen** (Senior Engineer): `sarah@novatask.io` / `Password123!`
- Or register any new custom account via the **"Sign Up"** tab!

---

## ⚡ Real-Time WebSocket Testing

Open **two separate browser windows or tabs** side-by-side at `http://localhost:5173`:
1. Look at the top bar — the green badge will update to **Live Sync (2)**.
2. In Tab A, drag a task from *To Do* to *In Progress* or create a new task.
3. In Tab B, watch the card instantly move and a toast notification appear with **zero page refresh required**!
