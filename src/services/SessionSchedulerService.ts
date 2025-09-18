import cron from 'node-cron';
import SessionGeneratorService from './SessionGeneratorService';

class SessionSchedulerService {
  private sessionGenerationJob: cron.ScheduledTask | null = null;

  /**
   * Start the session generation scheduler
   * Runs daily at 3:00 AM to generate sessions for the next 2 weeks
   */
  public startSessionGeneration(): void {
    if (this.sessionGenerationJob) {
      console.log('⚠️ Session generation scheduler is already running');
      return;
    }

    console.log('🕐 Starting session generation scheduler (daily at 3:00 AM)');

    // Schedule session generation to run daily at 3:00 AM
    this.sessionGenerationJob = cron.schedule('0 3 * * *', async () => {
      console.log('🔄 Running scheduled session generation...');
      try {
        await SessionGeneratorService.generateSessions({ 
          weeksAhead: 2, 
          skipExisting: true // Skip if sessions already exist for the range
        });
        
        // Log stats after generation
        const stats = await SessionGeneratorService.getGenerationStats();
        if (stats) {
          console.log(`📊 Post-generation stats: ${stats.futureSessions} future sessions available`);
        }
      } catch (error) {
        console.error('❌ Scheduled session generation failed:', error);
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    console.log('✅ Session generation scheduler started');
  }

  /**
   * Stop the session generation scheduler
   */
  public stopSessionGeneration(): void {
    if (this.sessionGenerationJob) {
      this.sessionGenerationJob.stop();
      this.sessionGenerationJob = null;
      console.log('🛑 Session generation scheduler stopped');
    }
  }

  /**
   * Manually trigger session generation (for testing or manual runs)
   */
  public async generateSessionsNow(): Promise<void> {
    console.log('🔄 Manually triggering session generation...');
    try {
      await SessionGeneratorService.generateSessions({ 
        weeksAhead: 2, 
        skipExisting: false // Manual runs can force regeneration
      });
      console.log('✅ Manual session generation completed');
    } catch (error) {
      console.error('❌ Manual session generation failed:', error);
      throw error;
    }
  }
}

export default new SessionSchedulerService();