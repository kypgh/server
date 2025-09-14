import { Request, Response } from 'express';
import { CreditPlan, ICreditPlan } from '../models/CreditPlan';
import { Class } from '../models/Class';
import { 
  creditPlanCreationSchema, 
  creditPlanUpdateSchema, 
  creditPlanQuerySchema 
} from '../validation/creditPlan';
import mongoose from 'mongoose';

type ObjectId = mongoose.Types.ObjectId;

class CreditPlanController {
  /**
   * Create a new credit plan
   */
  public static async createCreditPlan(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const { error, value } = creditPlanCreationSchema.validate(req.body);
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

      const brandId = req.user!.id;

      // Validate included classes belong to the brand
      if (value.includedClasses && value.includedClasses.length > 0) {
        const classIds = value.includedClasses.map((id: string) => new mongoose.Types.ObjectId(id));
        const classes = await Class.find({ 
          _id: { $in: classIds },
          brand: brandId 
        });

        if (classes.length !== value.includedClasses.length) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_002',
              message: 'One or more included classes do not belong to your brand'
            }
          });
          return;
        }
      }

      // Check for duplicate plan name within the brand
      const existingPlan = await CreditPlan.findOne({
        brand: brandId,
        name: value.name,
        status: 'active'
      });

      if (existingPlan) {
        res.status(409).json({
          success: false,
          error: {
            code: 'PLAN_001',
            message: 'A credit plan with this name already exists'
          }
        });
        return;
      }

      // Create credit plan
      const creditPlan = new CreditPlan({
        ...value,
        brand: brandId
      });

      await creditPlan.save();

      // Populate brand and classes for response
      await creditPlan.populate([
        { path: 'brand', select: 'name email' },
        { path: 'includedClasses', select: 'name category difficulty' }
      ]);

      res.status(201).json({
        success: true,
        data: {
          creditPlan
        }
      });
    } catch (error) {
      console.error('Error creating credit plan:', error);
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
   * Get all credit plans for the authenticated brand
   */
  public static async getCreditPlans(req: Request, res: Response): Promise<void> {
    try {
      // Validate query parameters
      const { error, value } = creditPlanQuerySchema.validate(req.query);
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

      const brandId = req.user!.id;
      const { 
        status, 
        minPrice, 
        maxPrice, 
        minCredits,
        maxCredits,
        minValidityPeriod,
        maxValidityPeriod,
        search, 
        page, 
        limit, 
        sortBy, 
        sortOrder 
      } = value;

      // Build query
      const query: any = { brand: brandId };

      if (status) {
        query.status = status;
      }

      if (minPrice !== undefined || maxPrice !== undefined) {
        query.price = {};
        if (minPrice !== undefined) query.price.$gte = minPrice;
        if (maxPrice !== undefined) query.price.$lte = maxPrice;
      }

      if (minCredits !== undefined || maxCredits !== undefined) {
        query.creditAmount = {};
        if (minCredits !== undefined) query.creditAmount.$gte = minCredits;
        if (maxCredits !== undefined) query.creditAmount.$lte = maxCredits;
      }

      if (minValidityPeriod !== undefined || maxValidityPeriod !== undefined) {
        query.validityPeriod = {};
        if (minValidityPeriod !== undefined) query.validityPeriod.$gte = minValidityPeriod;
        if (maxValidityPeriod !== undefined) query.validityPeriod.$lte = maxValidityPeriod;
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      // Build sort object
      const sort: any = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query with pagination
      const skip = (page - 1) * limit;
      
      const [creditPlans, total] = await Promise.all([
        CreditPlan.find(query)
          .populate([
            { path: 'brand', select: 'name email' },
            { path: 'includedClasses', select: 'name category difficulty' }
          ])
          .sort(sort)
          .skip(skip)
          .limit(limit),
        CreditPlan.countDocuments(query)
      ]);

      const totalPages = Math.ceil(total / limit);

      res.status(200).json({
        success: true,
        data: {
          creditPlans,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Error fetching credit plans:', error);
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
   * Get a specific credit plan by ID
   */
  public static async getCreditPlan(req: Request, res: Response): Promise<void> {
    try {
      const { planId } = req.params;
      const brandId = req.user!.id;

      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(planId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Invalid plan ID format'
          }
        });
        return;
      }

      const creditPlan = await CreditPlan.findOne({
        _id: planId,
        brand: brandId
      }).populate([
        { path: 'brand', select: 'name email' },
        { path: 'includedClasses', select: 'name category difficulty' }
      ]);

      if (!creditPlan) {
        res.status(404).json({
          success: false,
          error: {
            code: 'PLAN_002',
            message: 'Credit plan not found'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          creditPlan
        }
      });
    } catch (error) {
      console.error('Error fetching credit plan:', error);
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
   * Update a credit plan
   */
  public static async updateCreditPlan(req: Request, res: Response): Promise<void> {
    try {
      const { planId } = req.params;
      const brandId = req.user!.id;

      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(planId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Invalid plan ID format'
          }
        });
        return;
      }

      // Validate request body
      const { error, value } = creditPlanUpdateSchema.validate(req.body);
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

      // Check if plan exists and belongs to brand
      const existingPlan = await CreditPlan.findOne({
        _id: planId,
        brand: brandId
      });

      if (!existingPlan) {
        res.status(404).json({
          success: false,
          error: {
            code: 'PLAN_002',
            message: 'Credit plan not found'
          }
        });
        return;
      }

      // Validate included classes belong to the brand
      if (value.includedClasses && value.includedClasses.length > 0) {
        const classIds = value.includedClasses.map((id: string) => new mongoose.Types.ObjectId(id));
        const classes = await Class.find({ 
          _id: { $in: classIds },
          brand: brandId 
        });

        if (classes.length !== value.includedClasses.length) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_002',
              message: 'One or more included classes do not belong to your brand'
            }
          });
          return;
        }
      }

      // Check for duplicate plan name within the brand (excluding current plan)
      if (value.name) {
        const duplicatePlan = await CreditPlan.findOne({
          brand: brandId,
          name: value.name,
          status: 'active',
          _id: { $ne: planId }
        });

        if (duplicatePlan) {
          res.status(409).json({
            success: false,
            error: {
              code: 'PLAN_001',
              message: 'A credit plan with this name already exists'
            }
          });
          return;
        }
      }

      // Update credit plan
      const updatedPlan = await CreditPlan.findByIdAndUpdate(
        planId,
        { $set: value },
        { new: true, runValidators: true }
      ).populate([
        { path: 'brand', select: 'name email' },
        { path: 'includedClasses', select: 'name category difficulty' }
      ]);

      res.status(200).json({
        success: true,
        data: {
          creditPlan: updatedPlan
        }
      });
    } catch (error) {
      console.error('Error updating credit plan:', error);
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
   * Delete (deactivate) a credit plan
   */
  public static async deleteCreditPlan(req: Request, res: Response): Promise<void> {
    try {
      const { planId } = req.params;
      const brandId = req.user!.id;

      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(planId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Invalid plan ID format'
          }
        });
        return;
      }

      // Check if plan exists and belongs to brand
      const existingPlan = await CreditPlan.findOne({
        _id: planId,
        brand: brandId
      });

      if (!existingPlan) {
        res.status(404).json({
          success: false,
          error: {
            code: 'PLAN_002',
            message: 'Credit plan not found'
          }
        });
        return;
      }

      // Soft delete by setting status to inactive
      const updatedPlan = await CreditPlan.findByIdAndUpdate(
        planId,
        { $set: { status: 'inactive' } },
        { new: true }
      ).populate([
        { path: 'brand', select: 'name email' },
        { path: 'includedClasses', select: 'name category difficulty' }
      ]);

      res.status(200).json({
        success: true,
        data: {
          creditPlan: updatedPlan
        },
        message: 'Credit plan deactivated successfully'
      });
    } catch (error) {
      console.error('Error deleting credit plan:', error);
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

export default CreditPlanController;