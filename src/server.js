import express from 'express';
import http from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDB } from './db.js';
import { authRouter } from './routes/auth.js';
import { taskRouter } from './routes/tasks.js';
import { activityRouter } from './routes/activities.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Setup Socket.io
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  }
});

// Attach io to express app so route handlers can broadcast
app.set('io', io);

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Initialize Database & Tables
initDB();

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/tasks', taskRouter);
app.use('/api/activities', activityRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'NovaTask Backend Engine'
  });
});

// Socket.io connection handling
let connectedClients = 0;

io.on('connection', (socket) => {
  connectedClients++;
  console.log(`[Socket] Client connected: ${socket.id} (Total: ${connectedClients})`);
  io.emit('presence:update', { onlineCount: connectedClients });

  socket.on('join:room', (room) => {
    socket.join(room);
  });

  socket.on('disconnect', () => {
    connectedClients = Math.max(0, connectedClients - 1);
    console.log(`[Socket] Client disconnected: ${socket.id} (Total: ${connectedClients})`);
    io.emit('presence:update', { onlineCount: connectedClients });
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`  🚀 NovaTask Server Running on Port ${PORT}`);
  console.log(`  🔗 REST API:  http://localhost:${PORT}/api`);
  console.log(`  ⚡ WebSocket: ws://localhost:${PORT}`);
  console.log(`  💾 Database:  SQLite (Native Node 24)`);
  console.log(`===============================================`);
});
