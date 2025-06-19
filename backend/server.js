import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

import { ensurePineconeIndexExists } from './services/pineconeService.js';
import app from './app.js';

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  await ensurePineconeIndexExists(); // 👈 create index if needed

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
};

startServer();
