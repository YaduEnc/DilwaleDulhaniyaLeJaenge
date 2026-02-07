import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeSocketHandlers } from './socket/socketHandler.js';
import { socketAuthMiddleware } from './socket/authMiddleware.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Socket.IO Setup
const io = new Server(httpServer, {
    cors: {
        origin: [
            "http://localhost:5173",
            "http://localhost:3000",
            "https://dilwale-dulhaniya-le-jaenge.vercel.app",
            process.env.FRONTEND_URL || ""
        ].filter(Boolean),
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Auth Middleware for Socket.IO
io.use(socketAuthMiddleware);

// Health Check & Root
app.get('/', (req, res) => {
    res.send('Dilwale Backend is Running!');
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'up', timestamp: new Date().toISOString() });
});

// Initialize Socket Handlers
initializeSocketHandlers(io);

const PORT = process.env.PORT || 5001;

httpServer.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
