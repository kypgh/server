import { Request, Response } from 'express';
import { Class, IClass } from '../models/Class';
import { Brand } from '../models/Brand';
import { 
  classCreationSchema, 
  classUpdateSchema, 
  classQuerySchema 
} from '../validation/class';
import mongoose from 'mongoose';

interface ClassCreationRequest {
  name: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  slots: number;
  duration: number;
  cancellationPolicy?: number;
  timeBlocks?: Array<{
    day: string;
    startTime: string;
    endTime: string;
  }>;
  status?: 'active' | 'inactive';
}

interface ClassUpdateRequest extends Partial<ClassCreationRequest> {}

interface ClassQueryRequest {
  category?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  status?: 'active' | 'inactive';
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class ClassController {
  /**
   * Create a new class for the authenticated brand
   */
  public static async createClass(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const { error, value } = classCreationSchema.validate(req.body, { 
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

      const classData: ClassCreationRequest = value;
      const brandId = req.user!.id;

      // Verify brand exists and is active
      const brand = await Brand.findById(brandId);
      if (!brand || brand.status !== 'active') {
        res.status(404).json({
          success: false,
          error: {
            code: 'BRAND_001',
            message: 'Brand not found or inactive'
          }
        });
        return;
      }

      // Check for duplicate class name within the brand
      const existingClass = await Class.findOne({ 
        brand: brandId, 
        name: classData.name,
        status: 'active'
      });

      if (existingClass) {
        res.status(409).json({
          success: false,
          error: {
            code: 'CLASS_001',
            message: 'A class with this name already exists for your brand'
          }
        });
        return;
      }

      // Create the class
      const newClass = new Class({
        ...classData,
        brand: brandId
      });

      await newClass.save();

      // Populate brand information for response
      await newClass.populate('brand', 'name email');

      res.status(201).json({
        success: true,
        data: {
          class: newClass.toJSON()
        },
        message: 'Class created successfully'
      });

    } catch (error) {
      console.error('Class creation error:', error);
      
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
   * Get all classes for the authenticated brand with filtering and pagination
   */
  public static async getClasses(req: Request, res: Response): Promise<void> {
    try {
      // Validate query parameters
      const { error, value } = classQuerySchema.validate(req.query, { 
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

      const queryParams: ClassQueryRequest = value;
      const brandId = req.user!.id;

      // Build filter object
      const filter: any = { brand: brandId };

      if (queryParams.category) {
        filter.category = queryParams.category;
      }

      if (queryParams.difficulty) {
        filter.difficulty = queryParams.difficulty;
      }

      if (queryParams.status) {
        filter.status = queryParams.status;
      }

      if (queryParams.search) {
        filter.$or = [
          { name: { $regex: queryParams.search, $options: 'i' } },
          { description: { $regex: queryParams.search, $options: 'i' } },
          { category: { $regex: queryParams.search, $options: 'i' } }
        ];
      }

      // Build sort object
      const sortField = queryParams.sortBy || 'createdAt';
      const sortOrder = queryParams.sortOrder === 'asc' ? 1 : -1;
      const sort: { [key: string]: 1 | -1 } = { [sortField]: sortOrder };

      // Calculate pagination
      const page = queryParams.page || 1;
      const limit = queryParams.limit || 10;
      const skip = (page - 1) * limit;

      // Execute query with pagination
      const [classes, totalCount] = await Promise.all([
        Class.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .populate('brand', 'name email')
          .lean(),
        Class.countDocuments(filter)
      ]);

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      res.status(200).json({
        success: true,
        data: {
          classes,
          pagination: {
            currentPage: page,
            totalPages,
            totalCount,
            limit,
            hasNextPage,
            hasPrevPage
          }
        },
        message: 'Classes retrieved successfully'
      });

    } catch (error) {
      console.error('Get classes error:', error);
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
   * Get a specific class by ID (with brand ownership validation)
   */
  public static async getClassById(req: Request, res: Response): Promise<void> {
    try {
      const { classId } = req.params;
      const brandId = req.user!.id;

      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(classId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Invalid class ID format'
          }
        });
        return;
      }

      // Find class with brand ownership validation
      const classDoc = await Class.findOne({ 
        _id: classId, 
        brand: brandId 
      }).populate('brand', 'name email');

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

      res.status(200).json({
        success: true,
        data: {
          class: classDoc.toJSON()
        },
        message: 'Class retrieved successfully'
      });

    } catch (error) {
      console.error('Get class by ID error:', error);
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
   * Update a class (with brand ownership validation)
   */
  public static async updateClass(req: Request, res: Response): Promise<void> {
    try {
      const { classId } = req.params;
      const brandId = req.user!.id;

      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(classId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Invalid class ID format'
          }
        });
        return;
      }

      // Validate request body
      const { error, value } = classUpdateSchema.validate(req.body, { 
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

      const updateData: ClassUpdateRequest = value;

      // Find class with brand ownership validation
      const existingClass = await Class.findOne({ 
        _id: classId, 
        brand: brandId 
      });

      if (!existingClass) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CLASS_002',
            message: 'Class not found or access denied'
          }
        });
        return;
      }

      // Check for duplicate name if name is being updated
      if (updateData.name && updateData.name !== existingClass.name) {
        const duplicateClass = await Class.findOne({
          brand: brandId,
          name: updateData.name,
          _id: { $ne: classId },
          status: 'active'
        });

        if (duplicateClass) {
          res.status(409).json({
            success: false,
            error: {
              code: 'CLASS_001',
              message: 'A class with this name already exists for your brand'
            }
          });
          return;
        }
      }

      // Update the class
      const updatedClass = await Class.findByIdAndUpdate(
        classId,
        { $set: updateData },
        { 
          new: true, 
          runValidators: true 
        }
      ).populate('brand', 'name email');

      res.status(200).json({
        success: true,
        data: {
          class: updatedClass!.toJSON()
        },
        message: 'Class updated successfully'
      });

    } catch (error) {
      console.error('Update class error:', error);
      
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
   * Delete a class (soft delete by setting status to inactive)
   */
  public static async deleteClass(req: Request, res: Response): Promise<void> {
    try {
      const { classId } = req.params;
      const brandId = req.user!.id;

      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(classId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Invalid class ID format'
          }
        });
        return;
      }

      // Find class with brand ownership validation
      const existingClass = await Class.findOne({ 
        _id: classId, 
        brand: brandId 
      });

      if (!existingClass) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CLASS_002',
            message: 'Class not found or access denied'
          }
        });
        return;
      }

      // Soft delete by setting status to inactive
      const deletedClass = await Class.findByIdAndUpdate(
        classId,
        { $set: { status: 'inactive' } },
        { new: true }
      ).populate('brand', 'name email');

      res.status(200).json({
        success: true,
        data: {
          class: deletedClass!.toJSON()
        },
        message: 'Class deleted successfully'
      });

    } catch (error) {
      console.error('Delete class error:', error);
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
   * Get class statistics for the authenticated brand
   */
  public static async getClassStats(req: Request, res: Response): Promise<void> {
    try {
      const brandId = req.user!.id;

      const stats = await Class.aggregate([
        { $match: { brand: new mongoose.Types.ObjectId(brandId) } },
        {
          $group: {
            _id: null,
            totalClasses: { $sum: 1 },
            activeClasses: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            inactiveClasses: {
              $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] }
            },
            categoriesCount: { $addToSet: '$category' },
            difficulties: { $push: '$difficulty' },
            totalSlots: { $sum: '$slots' },
            averageDuration: { $avg: '$duration' }
          }
        },
        {
          $project: {
            _id: 0,
            totalClasses: 1,
            activeClasses: 1,
            inactiveClasses: 1,
            uniqueCategories: { $size: '$categoriesCount' },
            totalSlots: 1,
            averageDuration: { $round: ['$averageDuration', 0] },
            difficultyDistribution: {
              beginner: {
                $size: {
                  $filter: {
                    input: '$difficulties',
                    cond: { $eq: ['$$this', 'beginner'] }
                  }
                }
              },
              intermediate: {
                $size: {
                  $filter: {
                    input: '$difficulties',
                    cond: { $eq: ['$$this', 'intermediate'] }
                  }
                }
              },
              advanced: {
                $size: {
                  $filter: {
                    input: '$difficulties',
                    cond: { $eq: ['$$this', 'advanced'] }
                  }
                }
              }
            }
          }
        }
      ]);

      const result = stats[0] || {
        totalClasses: 0,
        activeClasses: 0,
        inactiveClasses: 0,
        uniqueCategories: 0,
        totalSlots: 0,
        averageDuration: 0,
        difficultyDistribution: {
          beginner: 0,
          intermediate: 0,
          advanced: 0
        }
      };

      res.status(200).json({
        success: true,
        data: {
          stats: result
        },
        message: 'Class statistics retrieved successfully'
      });

    } catch (error) {
      console.error('Get class stats error:', error);
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

export default ClassController;