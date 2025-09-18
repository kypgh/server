import { Session } from "../models/Session";
import { Class } from "../models/Class";

interface SessionGenerationOptions {
  weeksAhead?: number;
  skipExisting?: boolean;
}

class SessionGeneratorService {
  /**
   * Generate sessions for all active classes for the specified number of weeks
   */
  public static async generateSessions(
    options: SessionGenerationOptions = {}
  ): Promise<void> {
    const { weeksAhead = 2, skipExisting = true } = options;

    try {
      console.log("🔄 Starting session generation...");

      // Check if sessions already exist for the target date range
      if (skipExisting) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + weeksAhead * 7);

        const existingSessionsCount = await Session.countDocuments({
          dateTime: {
            $gte: new Date(),
            $lte: endDate,
          },
        });

        if (existingSessionsCount > 0) {
          console.log(
            `✅ Found ${existingSessionsCount} existing sessions in target range. Skipping generation.`
          );
          return;
        }
      }

      // Get all active classes with their time blocks
      const activeClasses = await Class.find({
        status: "active",
        timeBlocks: { $exists: true, $ne: [] },
      }).populate("brand");

      // Also check classes without timeBlocks for logging
      const classesWithoutTimeBlocks = await Class.countDocuments({
        status: "active",
        $or: [{ timeBlocks: { $exists: false } }, { timeBlocks: { $size: 0 } }],
      });

      if (activeClasses.length === 0) {
        console.log(
          "⚠️ No active classes with time blocks found. No sessions to generate."
        );
        if (classesWithoutTimeBlocks > 0) {
          console.log(
            `📝 Note: Found ${classesWithoutTimeBlocks} active classes without time blocks. These classes need time blocks to generate sessions.`
          );
        }
        return;
      }

      console.log(
        `📅 Generating sessions for ${activeClasses.length} classes over ${weeksAhead} weeks...`
      );
      if (classesWithoutTimeBlocks > 0) {
        console.log(
          `📝 Note: ${classesWithoutTimeBlocks} active classes don't have time blocks and will be skipped.`
        );
      }

      const sessionsToCreate = [];
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + weeksAhead * 7);

      console.log(
        `📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`
      );

      // Generate sessions for each class
      for (const classDoc of activeClasses) {
        const classSessions = this.generateSessionsForClass(
          classDoc,
          startDate,
          endDate
        );
        sessionsToCreate.push(...classSessions);
      }

      if (sessionsToCreate.length === 0) {
        console.log("⚠️ No sessions to create based on class schedules.");
        return;
      }

      // Bulk insert sessions with duplicate handling
      let createdSessions: any[] = [];
      let duplicateCount = 0;

      try {
        createdSessions = await Session.insertMany(sessionsToCreate, {
          ordered: false,
        });
      } catch (error: any) {
        // Handle duplicate key errors gracefully
        if (error.code === 11000) {
          // Some sessions already exist, filter out duplicates and retry
          console.log(
            "⚠️ Some sessions already exist, filtering duplicates..."
          );

          const existingSessions = await Session.find(
            {
              class: { $in: sessionsToCreate.map((s) => s.class) },
              dateTime: {
                $gte: startDate,
                $lte: endDate,
              },
            },
            { class: 1, dateTime: 1 }
          );

          const existingKeys = new Set(
            existingSessions.map((s) => `${s.class}_${s.dateTime.getTime()}`)
          );

          const newSessions = sessionsToCreate.filter((session) => {
            const key = `${session.class}_${session.dateTime.getTime()}`;
            const isDuplicate = existingKeys.has(key);
            if (isDuplicate) duplicateCount++;
            return !isDuplicate;
          });

          if (newSessions.length > 0) {
            createdSessions = await Session.insertMany(newSessions, {
              ordered: false,
            });
          }
        } else {
          throw error;
        }
      }

      console.log(
        `✅ Successfully generated ${createdSessions.length} new sessions`
      );
      if (duplicateCount > 0) {
        console.log(`⚠️ Skipped ${duplicateCount} duplicate sessions`);
      }
      console.log(`📊 Sessions created for ${activeClasses.length} classes`);
      console.log(
        `📅 Date range: ${startDate.toDateString()} to ${endDate.toDateString()}`
      );

      // Log breakdown by class
      const sessionsByClass = new Map();
      for (const session of createdSessions) {
        const classId = session.class.toString();
        sessionsByClass.set(classId, (sessionsByClass.get(classId) || 0) + 1);
      }

      console.log(`📋 Session breakdown:`);
      for (const classDoc of activeClasses) {
        const classId = classDoc._id.toString();
        const sessionCount = sessionsByClass.get(classId) || 0;
        console.log(`   - ${classDoc.name}: ${sessionCount} sessions`);
      }
    } catch (error) {
      console.error("❌ Error generating sessions:", error);
      throw error;
    }
  }

  /**
   * Generate sessions for a specific class based on its time blocks
   */
  private static generateSessionsForClass(
    classDoc: any,
    startDate: Date,
    endDate: Date
  ): any[] {
    const sessions = [];
    const dayMap = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    // Iterate through each day in the date range
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    while (currentDate <= endDate) {
      const dayName = Object.keys(dayMap).find(
        (day) => dayMap[day as keyof typeof dayMap] === currentDate.getDay()
      );

      if (dayName) {
        // Check if class has time blocks for this day
        const dayTimeBlocks = classDoc.timeBlocks.filter(
          (block: any) => block.day === dayName
        );

        for (const timeBlock of dayTimeBlocks) {
          const sessionDateTime = this.createSessionDateTime(
            currentDate,
            timeBlock.startTime
          );

          // Only create sessions for future dates
          if (sessionDateTime > new Date()) {
            sessions.push({
              class: classDoc._id,
              dateTime: sessionDateTime,
              capacity: classDoc.slots,
              attendees: [],
              status: "scheduled",
            });

            // Debug log for first few sessions
            if (sessions.length <= 3) {
              console.log(
                `   📅 Creating session: ${sessionDateTime.toISOString()} (${dayName} ${
                  timeBlock.startTime
                })`
              );
            }
          }
        }
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return sessions;
  }

  /**
   * Create a Date object for a session based on date and time string
   */
  private static createSessionDateTime(date: Date, timeString: string): Date {
    const [hours, minutes] = timeString.split(":").map(Number);
    const sessionDate = new Date(date);
    sessionDate.setHours(hours, minutes, 0, 0);
    return sessionDate;
  }

  /**
   * Clean up old completed or cancelled sessions
   */
  public static async cleanupOldSessions(daysOld: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await Session.deleteMany({
        dateTime: { $lt: cutoffDate },
        status: { $in: ["completed", "cancelled"] },
      });

      if (result.deletedCount > 0) {
        console.log(`🧹 Cleaned up ${result.deletedCount} old sessions`);
      }
    } catch (error) {
      console.error("❌ Error cleaning up old sessions:", error);
    }
  }

  /**
   * Get session generation statistics
   */
  public static async getGenerationStats(): Promise<any> {
    try {
      const now = new Date();
      const twoWeeksFromNow = new Date();
      twoWeeksFromNow.setDate(now.getDate() + 14);

      const [totalSessions, futureSessions, activeClasses] = await Promise.all([
        Session.countDocuments(),
        Session.countDocuments({
          dateTime: { $gte: now, $lte: twoWeeksFromNow },
          status: "scheduled",
        }),
        Class.countDocuments({ status: "active" }),
      ]);

      return {
        totalSessions,
        futureSessions,
        activeClasses,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error("❌ Error getting generation stats:", error);
      return null;
    }
  }
}

export default SessionGeneratorService;
