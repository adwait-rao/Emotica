import express from "express";
import dotenv from "dotenv";
import chatRoutes from "./src/routes/chat.js";

dotenv.config();
const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json());

app.use("/", chatRoutes);
app.get("/", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server at http://localhost:${PORT}`);
});
