import express from "express";
import cors from 'cors';
import notificationRoutes from "./src/routes/notifications.js";
import dotenv from "dotenv";
import http from "http";
// import { initializeWebSocketServer, startNotificationSystem } from "./src/scheduler/notifications.js";
import chatRoutes from "./src/routes/chat.js";
import authRoutes from "./src/routes/auth.js";
import schedulerManager from "./src/scheduler/index.js";

dotenv.config();
const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use("/", chatRoutes);
app.use('/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);
app.get("/", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// ⬇️ Create HTTP server manually
const server = http.createServer(app);

// ⬇️ Start WebSocket and Cron Notifications
// initializeWebSocketServer(server);
// startNotificationSystem();

await schedulerManager.initialize();

// ⬇️ Start HTTP+WS server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);

});

await schedulerManager.initialize();