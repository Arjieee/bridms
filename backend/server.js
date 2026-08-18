import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import accountsRoutes from './routes/accounts.js';
import householdsRoutes from './routes/households.js';
import membersRoutes from './routes/members.js';
import cyclesRoutes from './routes/cycles.js';
import inventoryRoutes from './routes/inventory.js';
import distributionsRoutes from './routes/distributions.js';
import suppliersRoutes from './routes/suppliers.js';
import qrcodesRoutes from './routes/qrcodes.js';
import notificationsRoutes from './routes/notifications.js';
import reportsRoutes from './routes/reports.js';
import settingsRoutes from './routes/settings.js';

import { prisma } from './db/prisma.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Quick DB query to verify database connectivity
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      message: 'Barangay Puerto Relief API is running with Prisma ORM.',
      database: 'connected',
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed.',
      error: err.message,
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/households', householdsRoutes);
app.use('/api/status-changes', membersRoutes);
app.use('/api/cycles', cyclesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/distributions', distributionsRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/qrcodes', qrcodesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/settings', settingsRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ ok: false, message: 'API Route not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ ok: false, message: 'Internal server error', error: err.message });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Barangay Puerto Relief Backend listening on http://localhost:${PORT}`);
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server and database connections');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server and database connections');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});

export default app;
