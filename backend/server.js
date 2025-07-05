import express from "express";
import dotenv from "dotenv";
import http from "http";
import { initializeWebSocketServer, startNotificationSystem } from "./src/scheduler/notifications.js";
import chatRoutes from "./src/routes/chat.js";
import "./src/scheduler/notifications.js";
import authRoutes from "./src/routes/auth.js";

dotenv.config();
const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json());

app.use("/", chatRoutes);
app.use('/auth', authRoutes);
app.get("/", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// ⬇️ Create HTTP server manually
const server = http.createServer(app);

// ⬇️ Start WebSocket and Cron Notifications
initializeWebSocketServer(server);
startNotificationSystem();

// ⬇️ Start HTTP+WS server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);

});
