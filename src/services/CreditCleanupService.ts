import cron from 'node-cron';
import CreditService from './CreditService';

class CreditCleanupService {
  private cleanupJob: cron.ScheduledTask | null = null;

  /**
   * Start the automatic cleanup service
   * Runs every day at 2:00 AM to cleanup expired credit packages
   */
  public startCleanupService(): void {
    if (this.cleanupJob) {
      console.log('Credit cleanup service is already running');
      return;
    }

    // Schedule cleanup to run daily at 2:00 AM
    this.cleanupJob = cron.schedule('0 2 * * *', async () => {
      try {
        console.log('Starting automatic credit cleanup...');
        await this.performCleanup();
        console.log('Credit cleanup completed successfully');
      } catch (error) {
        console.error('Error during credit cleanup:', error);
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    console.log('Credit cleanup service started - runs daily at 2:00 AM UTC');
  }

  /**
   * Stop the automatic cleanup service
   */
  public stopCleanupService(): void {
    if (this.cleanupJob) {
      this.cleanupJob.stop();
      this.cleanupJob = null;
      console.log('Credit cleanup service stopped');
    }
  }

  /**
   * Manually trigger cleanup (useful for testing or manual maintenance)
   */
  public async performCleanup(): Promise<void> {
    try {
      await CreditService.cleanupExpiredPackages();
    } catch (error) {
      console.error('Error performing credit cleanup:', error);
      throw error;
    }
  }

  /**
   * Get cleanup service status
   */
  public getStatus(): { running: boolean; nextRun?: Date } {
    if (!this.cleanupJob) {
      return { running: false };
    }

    return {
      running: true,
      nextRun: this.cleanupJob.nextDate()?.toDate()
    };
  }
}

export default new CreditCleanupService();