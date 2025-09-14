import express, { Application } from 'express';
import { helmetConfig, corsOptions, rateLimitConfig, requestLogger } from './middleware/security';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import cors from 'cors';
import config from './config/environment';
import apiRoutes from './routes';

class App {
  public app: Application;

  constructor() {
    this.app = express();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmetConfig);
    this.app.use(cors(corsOptions));
    this.app.use(rateLimitConfig);

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use(requestLogger);

    // Health check endpoint (before rate limiting for monitoring)
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        success: true,
        message: 'Server is healthy',
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv,
      });
    });
  }

  private initializeRoutes(): void {
    // API routes will be added here in future tasks
    this.app.get('/api', (req, res) => {
      res.status(200).json({
        success: true,
        message: 'Fitness Booking Platform API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      });
    });

    // Stripe webhook endpoint (needs to be before JSON parsing middleware)
    // This will be implemented in a future task
    // this.app.use('/api/webhooks', webhookRoutes);

    // Mount API routes
    this.app.use('/api', apiRoutes);
  }

  private initializeErrorHandling(): void {
    // Handle 404 for unmatched routes
    this.app.use(notFoundHandler);

    // Global error handler (must be last)
    this.app.use(errorHandler);
  }

  public getApp(): Application {
    return this.app;
  }
}

const appInstance = new App();
export const app = appInstance.getApp();
export default App;