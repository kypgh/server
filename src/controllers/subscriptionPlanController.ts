import { Request, Response } from 'express';
import { SubscriptionPlan, ISubscriptionPlan } from '../models/SubscriptionPlan';
import { Class } from '../models/Class';
import { 
  subscriptionPlanCreationSchema, 
  subscriptionPlanUpdateSchema, 
  subscriptionPlanQuerySchema 
} from '../validation/subscriptionPlan';
import mongoose from 'mongoose';

type ObjectId = mongoose.Types.ObjectId;

class SubscriptionPlanController {
  /**
   * Create a new subscription plan
   */
  public static async createSubscriptionPlan(req: Request, res: Response): Promise<void> {
    try {
      // Validate request body
      const { error, value } = subscriptionPlanCreationSchema.validate(req.body);
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
      const existingPlan = await SubscriptionPlan.findOne({
        brand: brandId,
        name: value.name,
        status: 'active'
      });

      if (existingPlan) {
        res.status(409).json({
          success: false,
          error: {
            code: 'PLAN_001',
            message: 'A subscription plan with this name already exists'
          }
        });
        return;
      }

      // Create subscription plan
      const subscriptionPlan = new SubscriptionPlan({
        ...value,
        brand: brandId
      });

      await subscriptionPlan.save();

      // Populate brand and classes for response
      await subscriptionPlan.populate([
        { path: 'brand', select: 'name email' },
        { path: 'includedClasses', select: 'name category difficulty' }
      ]);

      res.status(201).json({
        success: true,
        data: {
          subscriptionPlan
        }
      });
    } catch (error) {
      console.error('Error creating subscription plan:', error);
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
   * Get all subscription plans for the authenticated brand
   */
  public static async getSubscriptionPlans(req: Request, res: Response): Promise<void> {
    try {
      // Validate query parameters
      const { error, value } = subscriptionPlanQuerySchema.validate(req.query);
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
        billingCycle, 
        minPrice, 
        maxPrice, 
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

      if (billingCycle) {
        query.billingCycle = billingCycle;
      }

      if (minPrice !== undefined || maxPrice !== undefined) {
        query.price = {};
        if (minPrice !== undefined) query.price.$gte = minPrice;
        if (maxPrice !== undefined) query.price.$lte = maxPrice;
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
      
      const [subscriptionPlans, total] = await Promise.all([
        SubscriptionPlan.find(query)
          .populate([
            { path: 'brand', select: 'name email' },
            { path: 'includedClasses', select: 'name category difficulty' }
          ])
          .sort(sort)
          .skip(skip)
          .limit(limit),
        SubscriptionPlan.countDocuments(query)
      ]);

      const totalPages = Math.ceil(total / limit);

      res.status(200).json({
        success: true,
        data: {
          subscriptionPlans,
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
      console.error('Error fetching subscription plans:', error);
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
   * Get a specific subscription plan by ID
   */
  public static async getSubscriptionPlan(req: Request, res: Response): Promise<void> {
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

      const subscriptionPlan = await SubscriptionPlan.findOne({
        _id: planId,
        brand: brandId
      }).populate([
        { path: 'brand', select: 'name email' },
        { path: 'includedClasses', select: 'name category difficulty' }
      ]);

      if (!subscriptionPlan) {
        res.status(404).json({
          success: false,
          error: {
            code: 'PLAN_002',
            message: 'Subscription plan not found'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          subscriptionPlan
        }
      });
    } catch (error) {
      console.error('Error fetching subscription plan:', error);
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
   * Update a subscription plan
   */
  public static async updateSubscriptionPlan(req: Request, res: Response): Promise<void> {
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
      const { error, value } = subscriptionPlanUpdateSchema.validate(req.body);
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
      const existingPlan = await SubscriptionPlan.findOne({
        _id: planId,
        brand: brandId
      });

      if (!existingPlan) {
        res.status(404).json({
          success: false,
          error: {
            code: 'PLAN_002',
            message: 'Subscription plan not found'
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
        const duplicatePlan = await SubscriptionPlan.findOne({
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
              message: 'A subscription plan with this name already exists'
            }
          });
          return;
        }
      }

      // Update subscription plan
      const updatedPlan = await SubscriptionPlan.findByIdAndUpdate(
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
          subscriptionPlan: updatedPlan
        }
      });
    } catch (error) {
      console.error('Error updating subscription plan:', error);
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
   * Delete (deactivate) a subscription plan
   */
  public static async deleteSubscriptionPlan(req: Request, res: Response): Promise<void> {
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
      const existingPlan = await SubscriptionPlan.findOne({
        _id: planId,
        brand: brandId
      });

      if (!existingPlan) {
        res.status(404).json({
          success: false,
          error: {
            code: 'PLAN_002',
            message: 'Subscription plan not found'
          }
        });
        return;
      }

      // Soft delete by setting status to inactive
      const updatedPlan = await SubscriptionPlan.findByIdAndUpdate(
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
          subscriptionPlan: updatedPlan
        },
        message: 'Subscription plan deactivated successfully'
      });
    } catch (error) {
      console.error('Error deleting subscription plan:', error);
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

export default SubscriptionPlanController;