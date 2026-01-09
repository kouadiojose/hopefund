import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/error-handler';

// Routes
import authRoutes from './routes/auth.routes';
import clientRoutes from './routes/client.routes';
import accountRoutes from './routes/account.routes';
import transactionRoutes from './routes/transaction.routes';
import loanRoutes from './routes/loan.routes';
import reportRoutes from './routes/report.routes';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  message: { error: 'Too many requests, please try again later' },
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check (both with and without /api prefix)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes - support both with and without /api prefix for flexibility
// Routes without /api prefix (when DigitalOcean strips it)
app.use('/auth', authRoutes);
app.use('/clients', clientRoutes);
app.use('/accounts', accountRoutes);
app.use('/transactions', transactionRoutes);
app.use('/loans', loanRoutes);
app.use('/reports', reportRoutes);

// Routes with /api prefix (direct access)
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/reports', reportRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(config.port, () => {
  logger.info(`🚀 Hopefund API running on port ${config.port}`);
  logger.info(`📊 Environment: ${config.nodeEnv}`);
});

export default app;
