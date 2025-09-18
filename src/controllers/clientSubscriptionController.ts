import { Request, Response } from 'express';
import { Subscription, ISubscription } from '../models/Subscription';
import { SubscriptionPlan } from '../models/SubscriptionPlan';
import paymentService from '../services/paymentService';
import mongoose from 'mongoose';

type ObjectId = mongoose.Types.ObjectId;

class ClientSubscriptionController {
  /**
   * Purchase a subscription plan
   */
  public static async purchaseSubscription(req: Request, res: Response): Promise<void> {
    try {
      const clientId = req.user!.id;
      const { subscriptionPlanId, paymentMethodId } = req.body;

      // Validate subscription plan exists and is active
      const subscriptionPlan = await SubscriptionPlan.findById(subscriptionPlanId).populate('brand');
      if (!subscriptionPlan) {
        res.status(404).json({
          success: false,
          error: {
            code: 'PLAN_001',
            message: 'Subscription plan not found'
          }
        });
        return;
      }

      if (subscriptionPlan.status !== 'active') {
        res.status(400).json({
          success: false,
          error: {
            code: 'PLAN_002',
            message: 'Subscription plan is not active'
          }
        });
        return;
      }

      // Check for existing active subscription with this brand
      const existingSubscription = await Subscription.findOne({
        client: clientId,
        brand: subscriptionPlan.brand,
        status: 'active'
      });

      if (existingSubscription) {
        res.status(400).json({
          success: false,
          error: {
            code: 'SUBSCRIPTION_001',
            message: 'You already have an active subscription with this brand'
          }
        });
        return;
      }

      // Create PaymentIntent through PaymentService
      const paymentIntentData = await paymentService.createSubscriptionPaymentIntent({
        clientId,
        subscriptionPlanId,
        paymentMethodId
      });

      res.status(200).json({
        success: true,
        data: {
          paymentIntent: paymentIntentData,
          subscriptionPlan: {
            id: subscriptionPlan._id,
            name: subscriptionPlan.name,
            price: subscriptionPlan.price,
            billingCycle: subscriptionPlan.billingCycle,
            brand: subscriptionPlan.brand
          }
        }
      });
    } catch (error: any) {
      console.error('Error purchasing subscription:', error);
      
      // Handle specific payment service errors
      if (error.code && error.statusCode) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
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
   * Get client's subscriptions
   */
  public static async getSubscriptions(req: Request, res: Response): Promise<void> {
    try {
      const clientId = req.user!.id;
      const { 
        status, 
        brandId, 
        page = 1, 
        limit = 20, 
        sortBy = 'createdAt', 
        sortOrder = 'desc' 
      } = req.query;

      // Build query
      const query: any = { client: clientId };

      if (status) {
        query.status = status;
      }

      if (brandId) {
        if (!mongoose.Types.ObjectId.isValid(brandId as string)) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_001',
              message: 'Invalid brand ID format'
            }
          });
          return;
        }
        query.brand = brandId;
      }

      // Build sort object
      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

      // Execute query with pagination
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;
      
      const [subscriptions, total] = await Promise.all([
        Subscription.find(query)
          .populate([
            { 
              path: 'brand', 
              select: 'name email logo description' 
            },
            { 
              path: 'subscriptionPlan', 
              select: 'name description price billingCycle frequencyLimit includedClasses' 
            }
          ])
          .sort(sort)
          .skip(skip)
          .limit(limitNum),
        Subscription.countDocuments(query)
      ]);

      const totalPages = Math.ceil(total / limitNum);

      // Add computed fields for each subscription
      const enrichedSubscriptions = await Promise.all(
        subscriptions.map(async (subscription) => {
          const remainingFrequency = await subscription.getRemainingFrequency();
          const isValidForBooking = subscription.isValidForBooking();
          
          return {
            ...subscription.toObject(),
            remainingFrequency,
            isValidForBooking,
            daysUntilRenewal: Math.ceil(
              (subscription.nextBillingDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            )
          };
        })
      );

      res.status(200).json({
        success: true,
        data: {
          subscriptions: enrichedSubscriptions,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1
          }
        }
      });
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
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
   * Get a specific subscription by ID
   */
  public static async getSubscription(req: Request, res: Response): Promise<void> {
    try {
      const { subscriptionId } = req.params;
      const clientId = req.user!.id;

      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Invalid subscription ID format'
          }
        });
        return;
      }

      const subscription = await Subscription.findOne({
        _id: subscriptionId,
        client: clientId
      }).populate([
        { 
          path: 'brand', 
          select: 'name email logo description businessHours' 
        },
        { 
          path: 'subscriptionPlan', 
          select: 'name description price billingCycle frequencyLimit includedClasses',
          populate: {
            path: 'includedClasses',
            select: 'name category difficulty duration'
          }
        }
      ]);

      if (!subscription) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SUBSCRIPTION_002',
            message: 'Subscription not found'
          }
        });
        return;
      }

      // Add computed fields
      const remainingFrequency = await subscription.getRemainingFrequency();
      const isValidForBooking = subscription.isValidForBooking();
      
      const enrichedSubscription = {
        ...subscription.toObject(),
        remainingFrequency,
        isValidForBooking,
        daysUntilRenewal: Math.ceil(
          (subscription.nextBillingDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      };

      res.status(200).json({
        success: true,
        data: {
          subscription: enrichedSubscription
        }
      });
    } catch (error) {
      console.error('Error fetching subscription:', error);
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
   * Cancel a subscription
   */
  public static async cancelSubscription(req: Request, res: Response): Promise<void> {
    try {
      const { subscriptionId } = req.params;
      const clientId = req.user!.id;
      const { reason } = req.body;

      // Validate ObjectId format
      if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Invalid subscription ID format'
          }
        });
        return;
      }

      // Find subscription and ensure it belongs to the client
      const subscription = await Subscription.findOne({
        _id: subscriptionId,
        client: clientId
      }).populate('subscriptionPlan');

      if (!subscription) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SUBSCRIPTION_002',
            message: 'Subscription not found'
          }
        });
        return;
      }

      // Check if subscription can be cancelled
      if (subscription.status === 'cancelled') {
        res.status(400).json({
          success: false,
          error: {
            code: 'SUBSCRIPTION_003',
            message: 'Subscription is already cancelled'
          }
        });
        return;
      }

      if (subscription.status === 'expired') {
        res.status(400).json({
          success: false,
          error: {
            code: 'SUBSCRIPTION_004',
            message: 'Cannot cancel expired subscription'
          }
        });
        return;
      }

      // Cancel the subscription
      subscription.status = 'cancelled';
      subscription.cancelledAt = new Date();
      subscription.cancellationReason = reason || 'Cancelled by client';
      subscription.autoRenew = false;

      await subscription.save();

      // TODO: If this was a Stripe subscription, cancel it with Stripe as well
      // This would be handled in a future enhancement for recurring billing

      res.status(200).json({
        success: true,
        data: {
          subscription: {
            id: subscription._id,
            status: subscription.status,
            cancelledAt: subscription.cancelledAt,
            cancellationReason: subscription.cancellationReason
          }
        },
        message: 'Subscription cancelled successfully'
      });
    } catch (error) {
      console.error('Error cancelling subscription:', error);
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
   * Check subscription eligibility for booking
   */
  public static async checkBookingEligibility(req: Request, res: Response): Promise<void> {
    try {
      const { subscriptionId } = req.params;
      const { classId } = req.query;
      const clientId = req.user!.id;

      // Validate ObjectId formats
      if (!mongoose.Types.ObjectId.isValid(subscriptionId)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Invalid subscription ID format'
          }
        });
        return;
      }

      if (classId && !mongoose.Types.ObjectId.isValid(classId as string)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_001',
            message: 'Invalid class ID format'
          }
        });
        return;
      }

      // Find subscription
      const subscription = await Subscription.findOne({
        _id: subscriptionId,
        client: clientId
      }).populate('subscriptionPlan');

      if (!subscription) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SUBSCRIPTION_002',
            message: 'Subscription not found'
          }
        });
        return;
      }

      // Check basic eligibility
      const isValidForBooking = subscription.isValidForBooking();
      const remainingFrequency = await subscription.getRemainingFrequency();
      
      let canBookClass = true;
      let classEligibilityReason = '';

      // Check class-specific eligibility if classId provided
      if (classId) {
        canBookClass = await subscription.canBookClass(new mongoose.Types.ObjectId(classId as string));
        if (!canBookClass) {
          classEligibilityReason = 'Class is not included in your subscription plan';
        }
      }

      // Check frequency limits
      const hasFrequencyRemaining = remainingFrequency > 0;
      
      const eligibility = {
        eligible: isValidForBooking && hasFrequencyRemaining && canBookClass,
        reasons: [] as string[]
      };

      if (!isValidForBooking) {
        eligibility.reasons.push('Subscription is not active or outside billing period');
      }
      
      if (!hasFrequencyRemaining) {
        eligibility.reasons.push('Frequency limit reached for current period');
      }
      
      if (!canBookClass && classEligibilityReason) {
        eligibility.reasons.push(classEligibilityReason);
      }

      res.status(200).json({
        success: true,
        data: {
          eligibility,
          subscription: {
            id: subscription._id,
            status: subscription.status,
            remainingFrequency,
            frequencyResetDate: subscription.frequencyResetDate,
            currentPeriodEnd: subscription.currentPeriodEnd
          }
        }
      });
    } catch (error) {
      console.error('Error checking booking eligibility:', error);
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

export default ClientSubscriptionController;