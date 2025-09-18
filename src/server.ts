import App from './app';
import DatabaseConnection from './config/database';
import config from './config/environment';
import CreditCleanupService from './services/CreditCleanupService';
import SessionGeneratorService from './services/SessionGeneratorService';
import SessionSchedulerService from './services/SessionSchedulerService';

class Server {
  private app: App;
  private database: DatabaseConnection;

  constructor() {
    this.app = new App();
    this.database = DatabaseConnection.getInstance();
  }

  public async start(): Promise<void> {
    try {
      // Connect to database
      await this.database.connect();

      // Generate sessions for the next 2 weeks if none exist
      await SessionGeneratorService.generateSessions({ weeksAhead: 2, skipExisting: true });
      
      // Log session generation stats
      const stats = await SessionGeneratorService.getGenerationStats();
      if (stats) {
        console.log(`📊 Session Generation Stats:`);
        console.log(`   - Total sessions in DB: ${stats.totalSessions}`);
        console.log(`   - Future sessions (next 2 weeks): ${stats.futureSessions}`);
        console.log(`   - Active classes: ${stats.activeClasses}`);
      }

      // Start background services
      CreditCleanupService.startCleanupService();
      SessionSchedulerService.startSessionGeneration();

      // Start the server
      const server = this.app.getApp().listen(config.port, () => {
        console.log(`🚀 Server running on port ${config.port}`);
        console.log(`📊 Environment: ${config.nodeEnv}`);
        console.log(`🔗 Health check: http://localhost:${config.port}/health`);
        console.log(`📡 API endpoint: http://localhost:${config.port}/api`);
      });

      // Graceful shutdown handling
      const gracefulShutdown = async (signal: string): Promise<void> => {
        console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
        
        server.close(async () => {
          console.log('✅ HTTP server closed');
          
          try {
            // Stop background services
            CreditCleanupService.stopCleanupService();
            SessionSchedulerService.stopSessionGeneration();
            console.log('✅ Background services stopped');
            
            await this.database.disconnect();
            console.log('✅ Database connection closed');
            console.log('✅ Graceful shutdown completed');
            process.exit(0);
          } catch (error) {
            console.error('❌ Error during graceful shutdown:', error);
            process.exit(1);
          }
        });

        // Force close after 10 seconds
        setTimeout(() => {
          console.error('❌ Forced shutdown after timeout');
          process.exit(1);
        }, 10000);
      };

      // Handle shutdown signals
      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));

      // Handle uncaught exceptions
      process.on('uncaughtException', (error) => {
        console.error('❌ Uncaught Exception:', error);
        gracefulShutdown('uncaughtException');
      });

      // Handle unhandled promise rejections
      process.on('unhandledRejection', (reason, promise) => {
        console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
        gracefulShutdown('unhandledRejection');
      });

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Start the server
const server = new Server();
server.start().catch((error) => {
  console.error('❌ Server startup failed:', error);
  process.exit(1);
});