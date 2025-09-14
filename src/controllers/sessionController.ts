import { Request, Response } from 'express';
import { Session, ISession } from '../models/Session';
import { Class, IClass } from '../models/Class';
import { 
  sessionCreationSchema, 
  sessionUpdateSchema, 
  sessionQuerySchema,
  bulkSessionCreationSchema 
} from '../validation/session';
import mongoose from 'mongoose';

interface SessionCreationRequest {
  class: string;
  dateTime: Date;
  capacity?: number;
  status?: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
}

interface SessionUpdateRequest {
  dateTime?: Date;
  capacity?: number;
  status?: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
}

interface BulkSessionCreationRequest {
  class: string;
  startDate: Date;
  endDate: Date;
  capacity?: number;
  excludeDates?: Date[];
}

interface SessionQueryRequest {
  class?: string;
  status?: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  startDate?: Date;
  endDate?: Date;
  availableOnly?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class SessionController {
  /**
   * Create a new session for a class owned by the authenticated brand
   */
  public static async createSession(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const { error, value } = sessionCreationSchema.validate(req.body, { 
        abortEarly: false,
        stripUnknown: true 
      });

      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Invalid input data',
            details: error.details.map(detail => ({
              field: detail.path.join('.'),
              message: detail.message
            }))
          }
        });
        return;
      }

      const sessionData: SessionCreationRequest = value;
      const brandId = req.user!.id;

      // Verify class exists and belongs to the brand
      const classDoc = await Class.findOne({ 
        _id: sessionData.class, 
        brand: brandId,
        status: 'active'
      });

      if (!classDoc) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CLASS_002',
            message: 'Class not found or access denied'
          }
        });
        return;
      }

      // Use class capacity if session capacity not provided
      const capacity = sessionData.capacity || classDoc.slots;

      // Validate capacity doesn't exceed class slots
      if (capacity > classDoc.slots) {
        res.status(400).json({
          success: false,
          error: {
            code: 'SESSION_001',
            message: `Session capacity (${capacity}) cannot exceed class slots (${classDoc.slots})`
          }
        });
        return;
      }

      // Check for duplicate session at the same time for the same class
      const existingSession = await Session.findOne({
        class: sessionData.class,
        dateTime: sessionData.dateTime,
        status: { $ne: 'cancelled' }
      });

      if (existingSession) {
        res.status(409).json({
          success: false,
          error: {
            code: 'SESSION_002',
            message: 'A session already exists for this class at the specified time'
          }
        });
        return;
      }

      // Create the session
      const newSession = new Session({
        ...sessionData,
        capacity
      });

      await newSession.save();

      // Populate class information for response
      await newSession.populate('class', 'name brand description category difficulty');

      res.status(201).json({
        success: true,
        data: {
          session: newSession.toJSON()
        },
        message: 'Session created successfully'
      });

    } catch (error) {
      console.error('Session creation error:', error);
      
      // Handle MongoDB validation errors
      if (error instanceof mongoose.Error.ValidationError) {
        const validationErrors = Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message
        }));

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Validation failed',
            details: validationErrors
          }
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_001',
          message: 'Internal server error'
        }
      });
    }
  }

  /**
   * Get all sessions for classes owned by the authenticated brand with filtering and pagination
   */
  public static async getSessions(req: Request, res: Response): Promise<void> {
    try {
      // Validate query parameters
      const { error, value } = sessionQuerySchema.validate(req.query, { 
        abortEarly: false,
        stripUnknown: true 
      });

      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Invalid query parameters',
            details: error.details.map(detail => ({
              field: detail.path.join('.'),
              message: detail.message
            }))
          }
        });
        return;
      }

      const queryParams: SessionQueryRequest = value;
      const brandId = req.user!.id;

      // Get all class IDs for the brand
      const brandClasses = await Class.find({ 
        brand: brandId,
        status: 'active'
      }).select('_id');
      
      const brandClassIds = brandClasses.map(c => c._id);

      if (brandClassIds.length === 0) {
        res.status(200).json({
          success: true,
          data: {
            sessions: [],
            pagination: {
              currentPage: 1,
              totalPages: 0,
              totalCount: 0,
              limit: queryParams.limit || 10,
              hasNextPage: false,
              hasPrevPage: false
            }
          },
          message: 'No sessions found'
        });
        return;
      }

      // Build filter object
      const filter: any = { 
        class: { $in: brandClassIds }
      };

      if (queryParams.class) {
        // Verify the specific class belongs to the brand
        if (!brandClassIds.some(id => id.toString() === queryParams.class)) {
          res.status(403).json({
            success: false,
            error: {
              code: 'SESSION_003',
              message: 'Access denied to sessions for this class'
            }
          });
          return;
        }
        filter.class = queryParams.class;
      }

      if (queryParams.status) {
        filter.status = queryParams.status;
      }

      if (queryParams.startDate || queryParams.endDate) {
        filter.dateTime = {};
        if (queryParams.startDate) {
          filter.dateTime.$gte = queryParams.startDate;
        }
        if (queryParams.endDate) {
          filter.dateTime.$lte = queryParams.endDate;
        }
      }

      // Build sort object
      const sortField = queryParams.sortBy || 'dateTime';
      const sortOrder = queryParams.sortOrder === 'desc' ? -1 : 1;
      const sort: { [key: string]: 1 | -1 } = { [sortField]: sortOrder };

      // Calculate pagination
      const page = queryParams.page || 1;
      const limit = queryParams.limit || 10;
      const skip = (page - 1) * limit;

      let query = Session.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('class', 'name brand description category difficulty slots');

      // Apply available only filter if requested
      if (queryParams.availableOnly) {
        query = query.where('$expr', {
          $gt: ['$capacity', { $size: '$attendees' }]
        });
      }

      const [sessions, totalCount] = await Promise.all([
        query.lean(),
        queryParams.availableOnly 
          ? Session.countDocuments({
              ...filter,
              $expr: { $gt: ['$capacity', { $size: '$attendees' }] }
            })
          : Session.countDocuments(filter)
      ]);

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      res.status(200).json({
        success: true,
        data: {
          sessions,
          pagination: {
            currentPage: page,
            totalPages,
            totalCount,
            limit,
            hasNextPage,
            hasPrevPage
          }
        },
        message: 'Sessions retrieved successfully'
      });

    } catch (error) {
      console.error('Get sessions error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_001',
          message: 'Internal server error'
        }
      });
    }
  }
  /**

   * Get a specific session by ID (with brand ownership validation)
   */
  public static async getSessionById(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const brandId = req.user!.id;

      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(sessionId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Invalid session ID format'
          }
        });
        return;
      }

      // Find session and verify brand ownership through class
      const session = await Session.findById(sessionId)
        .populate({
          path: 'class',
          select: 'name brand description category difficulty slots',
          match: { brand: brandId }
        })
        .populate('attendees.client', 'firstName lastName email');

      if (!session || !session.class) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SESSION_004',
            message: 'Session not found or access denied'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          session: session.toJSON()
        },
        message: 'Session retrieved successfully'
      });

    } catch (error) {
      console.error('Get session by ID error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_001',
          message: 'Internal server error'
        }
      });
    }
  }

  /**
   * Update a session (with brand ownership validation)
   */
  public static async updateSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const brandId = req.user!.id;

      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(sessionId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Invalid session ID format'
          }
        });
        return;
      }

      // Validate request body
      const { error, value } = sessionUpdateSchema.validate(req.body, { 
        abortEarly: false,
        stripUnknown: true 
      });

      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Invalid input data',
            details: error.details.map(detail => ({
              field: detail.path.join('.'),
              message: detail.message
            }))
          }
        });
        return;
      }

      const updateData: SessionUpdateRequest = value;

      // Find session and verify brand ownership through class
      const existingSession = await Session.findById(sessionId).populate('class');

      if (!existingSession || !existingSession.class || 
          (existingSession.class as any).brand.toString() !== brandId) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SESSION_004',
            message: 'Session not found or access denied'
          }
        });
        return;
      }

      // Validate capacity constraints if being updated
      if (updateData.capacity) {
        const classDoc = existingSession.class as any;
        
        // Check against class slots
        if (updateData.capacity > classDoc.slots) {
          res.status(400).json({
            success: false,
            error: {
              code: 'SESSION_001',
              message: `Session capacity (${updateData.capacity}) cannot exceed class slots (${classDoc.slots})`
            }
          });
          return;
        }

        // Check against current attendees
        if (updateData.capacity < existingSession.attendees.length) {
          res.status(400).json({
            success: false,
            error: {
              code: 'SESSION_005',
              message: `Cannot reduce capacity below current attendees count (${existingSession.attendees.length})`
            }
          });
          return;
        }
      }

      // Check for time conflicts if dateTime is being updated
      if (updateData.dateTime) {
        const conflictingSession = await Session.findOne({
          _id: { $ne: sessionId },
          class: existingSession.class,
          dateTime: updateData.dateTime,
          status: { $ne: 'cancelled' }
        });

        if (conflictingSession) {
          res.status(409).json({
            success: false,
            error: {
              code: 'SESSION_002',
              message: 'A session already exists for this class at the specified time'
            }
          });
          return;
        }
      }

      // Update the session
      const updatedSession = await Session.findByIdAndUpdate(
        sessionId,
        { $set: updateData },
        { 
          new: true, 
          runValidators: true 
        }
      ).populate('class', 'name brand description category difficulty slots');

      res.status(200).json({
        success: true,
        data: {
          session: updatedSession!.toJSON()
        },
        message: 'Session updated successfully'
      });

    } catch (error) {
      console.error('Update session error:', error);
      
      // Handle MongoDB validation errors
      if (error instanceof mongoose.Error.ValidationError) {
        const validationErrors = Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message
        }));

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Validation failed',
            details: validationErrors
          }
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_001',
          message: 'Internal server error'
        }
      });
    }
  }

  /**
   * Delete a session (cancel session and handle existing bookings)
   */
  public static async deleteSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const brandId = req.user!.id;

      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(sessionId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Invalid session ID format'
          }
        });
        return;
      }

      // Find session and verify brand ownership through class
      const existingSession = await Session.findById(sessionId).populate('class');

      if (!existingSession || !existingSession.class || 
          (existingSession.class as any).brand.toString() !== brandId) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SESSION_004',
            message: 'Session not found or access denied'
          }
        });
        return;
      }

      // Check if session can be cancelled
      if (!existingSession.canBeCancelled()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'SESSION_006',
            message: 'Cannot cancel past sessions or sessions that are not scheduled'
          }
        });
        return;
      }

      // Cancel the session (soft delete)
      const cancelledSession = await Session.findByIdAndUpdate(
        sessionId,
        { $set: { status: 'cancelled' } },
        { new: true }
      ).populate('class', 'name brand description category difficulty slots');

      // TODO: In future tasks, handle booking cancellations and refunds here
      // This would involve:
      // 1. Finding all bookings for this session
      // 2. Cancelling them and processing refunds
      // 3. Sending notifications to affected clients

      res.status(200).json({
        success: true,
        data: {
          session: cancelledSession!.toJSON()
        },
        message: 'Session cancelled successfully'
      });

    } catch (error) {
      console.error('Delete session error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_001',
          message: 'Internal server error'
        }
      });
    }
  }

  /**
   * Create multiple sessions for recurring schedules
   */
  public static async createBulkSessions(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const { error, value } = bulkSessionCreationSchema.validate(req.body, { 
        abortEarly: false,
        stripUnknown: true 
      });

      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Invalid input data',
            details: error.details.map(detail => ({
              field: detail.path.join('.'),
              message: detail.message
            }))
          }
        });
        return;
      }

      const bulkData: BulkSessionCreationRequest = value;
      const brandId = req.user!.id;

      // Verify class exists and belongs to the brand
      const classDoc = await Class.findOne({ 
        _id: bulkData.class, 
        brand: brandId,
        status: 'active'
      });

      if (!classDoc) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CLASS_002',
            message: 'Class not found or access denied'
          }
        });
        return;
      }

      // Use class capacity if session capacity not provided
      const capacity = bulkData.capacity || classDoc.slots;

      // Validate capacity doesn't exceed class slots
      if (capacity > classDoc.slots) {
        res.status(400).json({
          success: false,
          error: {
            code: 'SESSION_001',
            message: `Session capacity (${capacity}) cannot exceed class slots (${classDoc.slots})`
          }
        });
        return;
      }

      // Generate sessions based on class time blocks
      const sessionsToCreate: any[] = [];
      const excludeDatesSet = new Set(
        (bulkData.excludeDates || []).map(date => date.toISOString().split('T')[0])
      );

      const startDate = new Date(bulkData.startDate);
      const endDate = new Date(bulkData.endDate);

      // Iterate through each day in the date range
      for (let currentDate = new Date(startDate); currentDate <= endDate; currentDate.setDate(currentDate.getDate() + 1)) {
        const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const dateString = currentDate.toISOString().split('T')[0];

        // Skip excluded dates
        if (excludeDatesSet.has(dateString)) {
          continue;
        }

        // Find matching time blocks for this day
        const matchingTimeBlocks = classDoc.timeBlocks.filter(block => block.day === dayName);

        for (const timeBlock of matchingTimeBlocks) {
          const [hours, minutes] = timeBlock.startTime.split(':').map(Number);
          const sessionDateTime = new Date(currentDate);
          sessionDateTime.setHours(hours, minutes, 0, 0);

          // Skip if session time is in the past
          if (sessionDateTime <= new Date()) {
            continue;
          }

          // Check for existing session at this time
          const existingSession = await Session.findOne({
            class: bulkData.class,
            dateTime: sessionDateTime,
            status: { $ne: 'cancelled' }
          });

          if (!existingSession) {
            sessionsToCreate.push({
              class: bulkData.class,
              dateTime: sessionDateTime,
              capacity,
              status: 'scheduled'
            });
          }
        }
      }

      if (sessionsToCreate.length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'SESSION_007',
            message: 'No valid sessions to create. Check date range, time blocks, and existing sessions.'
          }
        });
        return;
      }

      // Create sessions in bulk
      const createdSessions = await Session.insertMany(sessionsToCreate);

      // Populate class information for response
      const populatedSessions = await Session.find({
        _id: { $in: createdSessions.map(s => s._id) }
      }).populate('class', 'name brand description category difficulty slots');

      res.status(201).json({
        success: true,
        data: {
          sessions: populatedSessions,
          count: createdSessions.length
        },
        message: `${createdSessions.length} sessions created successfully`
      });

    } catch (error) {
      console.error('Bulk session creation error:', error);
      
      // Handle MongoDB validation errors
      if (error instanceof mongoose.Error.ValidationError) {
        const validationErrors = Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message
        }));

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Validation failed',
            details: validationErrors
          }
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_001',
          message: 'Internal server error'
        }
      });
    }
  }

  /**
   * Get session statistics for the authenticated brand
   */
  public static async getSessionStats(req: Request, res: Response): Promise<void> {
    try {
      const brandId = req.user!.id;

      // Get all class IDs for the brand
      const brandClasses = await Class.find({ 
        brand: brandId,
        status: 'active'
      }).select('_id');
      
      const brandClassIds = brandClasses.map(c => c._id);

      if (brandClassIds.length === 0) {
        res.status(200).json({
          success: true,
          data: {
            stats: {
              totalSessions: 0,
              scheduledSessions: 0,
              completedSessions: 0,
              cancelledSessions: 0,
              totalCapacity: 0,
              totalBookings: 0,
              averageUtilization: 0,
              upcomingSessions: 0
            }
          },
          message: 'Session statistics retrieved successfully'
        });
        return;
      }

      const stats = await Session.aggregate([
        { $match: { class: { $in: brandClassIds } } },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            scheduledSessions: {
              $sum: { $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0] }
            },
            completedSessions: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            cancelledSessions: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            },
            totalCapacity: { $sum: '$capacity' },
            totalBookings: { $sum: { $size: '$attendees' } },
            upcomingSessions: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$status', 'scheduled'] },
                      { $gt: ['$dateTime', new Date()] }
                    ]
                  },
                  1,
                  0
                ]
              }
            }
          }
        },
        {
          $project: {
            _id: 0,
            totalSessions: 1,
            scheduledSessions: 1,
            completedSessions: 1,
            cancelledSessions: 1,
            totalCapacity: 1,
            totalBookings: 1,
            upcomingSessions: 1,
            averageUtilization: {
              $cond: [
                { $gt: ['$totalCapacity', 0] },
                { $multiply: [{ $divide: ['$totalBookings', '$totalCapacity'] }, 100] },
                0
              ]
            }
          }
        }
      ]);

      const result = stats[0] || {
        totalSessions: 0,
        scheduledSessions: 0,
        completedSessions: 0,
        cancelledSessions: 0,
        totalCapacity: 0,
        totalBookings: 0,
        averageUtilization: 0,
        upcomingSessions: 0
      };

      // Round utilization to 2 decimal places
      result.averageUtilization = Math.round(result.averageUtilization * 100) / 100;

      res.status(200).json({
        success: true,
        data: {
          stats: result
        },
        message: 'Session statistics retrieved successfully'
      });

    } catch (error) {
      console.error('Get session stats error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_001',
          message: 'Internal server error'
        }
      });
    }
  }
}

export default SessionController;