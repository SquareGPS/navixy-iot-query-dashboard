import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';

// Load environment variables FIRST
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
const envPath = path.resolve(__dirname, '../.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn('Warning: Could not load .env file:', result.error.message);
} else {
  console.log('Environment variables loaded from .env file');
}

// Now import services that depend on environment variables
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authenticateToken } from './middleware/auth.js';
import sqlRoutes from './routes/sql-new.js';
import { healthRoutes } from './routes/health.js';
import { analyticsRoutes } from './routes/analytics.js';
import appRoutes from './routes/app.js';
import menuRoutes from './routes/menu.js';
import { DatabaseService } from './services/database.js';
import { RedisService } from './services/redis.js';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// Trust proxy - Required when behind nginx reverse proxy
// Trust only the first proxy (nginx on the same host)
// This allows Express to correctly identify client IPs and handle X-Forwarded-* headers
// while preventing IP spoofing attacks
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
// Supports both HTTP and HTTPS
// Additional origins can be configured via CORS_ALLOWED_ORIGINS environment variable (comma-separated)
const baseOrigins = [
  'http://localhost',
  'http://localhost:80',
  'https://localhost',
  'https://localhost:443',
  'http://localhost:8080',
  'https://localhost:8080',
  'http://localhost:8081',
  'https://localhost:8081',
  'http://localhost:3000',
  'https://localhost:3000',
];

// Parse additional origins from environment variable
const additionalOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean)
  : [];

const allowedOrigins = [...baseOrigins, ...additionalOrigins];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is localhost (for local development even in production mode)
    // Allow both http://localhost and https://localhost (and with ports)
    const isLocalhost = origin.startsWith('http://localhost') || 
                       origin.startsWith('https://localhost') ||
                       origin.startsWith('http://127.0.0.1') ||
                       origin.startsWith('https://127.0.0.1');
    
    if (allowedOrigins.includes(origin) || isLocalhost) {
      callback(null, true);
    } else {
      // In development, allow any origin for easier testing
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        // In production, reject unknown origins
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Rate limiting - More generous limits for development
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000'), // Increased from 100 to 1000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for localhost in development
  skip: (req) => {
    return !!(process.env.NODE_ENV === 'development' && 
           (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip?.startsWith('::ffff:127.0.0.1')));
  },
});

app.use(limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
  });
  next();
});

// Health check (no auth required)
app.use('/health', healthRoutes);

// App routes (authentication, settings, reports)
app.use('/api', appRoutes);

// Menu management routes
app.use('/api', menuRoutes);

// Protected routes
app.use('/api/sql', authenticateToken, sqlRoutes);
app.use('/api/sql-new', authenticateToken, sqlRoutes);
app.use('/api/analytics', authenticateToken, analyticsRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  try {
    await DatabaseService.getInstance().closeAllConnections();
    await RedisService.getInstance().close();
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }
  
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  try {
    await DatabaseService.getInstance().closeAllConnections();
    await RedisService.getInstance().close();
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }
  
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Initialize services and start server
async function startServer() {
  try {
    // Validate required environment variables
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'fallback-secret') {
      logger.error('JWT_SECRET is not set or is using fallback value. Please set JWT_SECRET in your environment variables.');
      process.exit(1);
    }

    // Initialize database service (no connection yet - connects on first request)
    await DatabaseService.initialize();
    logger.info('Database service initialized');

    // Initialize Redis connection
    await RedisService.initialize();
    logger.info('Redis service initialized');

    // Start server
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`, {
        environment: process.env.NODE_ENV,
        port: PORT,
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { app, server };
