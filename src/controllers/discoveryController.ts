import { Request, Response } from "express";
import { Brand } from "../models/Brand";
import { Class } from "../models/Class";
import { Session } from "../models/Session";
import { SubscriptionPlan } from "../models/SubscriptionPlan";
import { CreditPlan } from "../models/CreditPlan";
import {
  brandDiscoverySchema,
  classDiscoverySchema,
  sessionDiscoverySchema,
  brandIdParamSchema,
} from "../validation/discovery";
import mongoose from "mongoose";

interface BrandDiscoveryQuery {
  search?: string;
  city?: string;
  state?: string;
  status?: "active" | "inactive";
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

interface ClassDiscoveryQuery {
  search?: string;
  category?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  brand?: string;
  city?: string;
  state?: string;
  minDuration?: number;
  maxDuration?: number;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

interface SessionDiscoveryQuery {
  search?: string;
  brand?: string;
  class?: string;
  category?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  startDate?: Date;
  endDate?: Date;
  availableOnly?: boolean;
  city?: string;
  state?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

class DiscoveryController {
  /**
   * Get all brands with filtering and search capabilities
   * Requirements: 8.1 - WHEN a client browses brands THEN the system SHALL display all active brands with basic information
   */
  public static async getBrands(req: Request, res: Response): Promise<void> {
    try {
      // Validate query parameters
      const { error, value } = brandDiscoverySchema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_001",
            message: "Invalid query parameters",
            details: error.details.map((detail) => ({
              field: detail.path.join("."),
              message: detail.message,
            })),
          },
        });
        return;
      }

      const queryParams: BrandDiscoveryQuery = value;

      // Build filter object
      const filter: any = { status: queryParams.status || "active" };

      if (queryParams.search) {
        filter.$or = [
          { name: { $regex: queryParams.search, $options: "i" } },
          { description: { $regex: queryParams.search, $options: "i" } },
        ];
      }

      if (queryParams.city) {
        filter["address.city"] = { $regex: queryParams.city, $options: "i" };
      }

      if (queryParams.state) {
        filter["address.state"] = { $regex: queryParams.state, $options: "i" };
      }

      // Build sort object
      const sortField = queryParams.sortBy || "name";
      const sortOrder = queryParams.sortOrder === "desc" ? -1 : 1;
      const sort: { [key: string]: 1 | -1 } = { [sortField]: sortOrder };

      // Calculate pagination
      const page = queryParams.page || 1;
      const limit = queryParams.limit || 10;
      const skip = (page - 1) * limit;

      // Execute query with pagination
      const [brands, totalCount] = await Promise.all([
        Brand.find(filter)
          .select("-password -stripeConnectAccountId") // Exclude sensitive fields
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Brand.countDocuments(filter),
      ]);

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      res.status(200).json({
        success: true,
        data: {
          brands,
          pagination: {
            currentPage: page,
            totalPages,
            totalCount,
            limit,
            hasNextPage,
            hasPrevPage,
          },
        },
        message: "Brands retrieved successfully",
      });
    } catch (error) {
      console.error("Get brands error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "SERVER_001",
          message: "Internal server error",
        },
      });
    }
  }

  /**
   * Get brand details with class information
   * Requirements: 8.2 - WHEN a client views a specific brand THEN the system SHALL show detailed brand information and available classes
   */
  public static async getBrandById(req: Request, res: Response): Promise<void> {
    try {
      // Validate brand ID parameter
      const { error: paramError, value: paramValue } =
        brandIdParamSchema.validate(req.params, {
          abortEarly: false,
          stripUnknown: true,
        });

      if (paramError) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_001",
            message: "Invalid brand ID",
            details: paramError.details.map((detail) => ({
              field: detail.path.join("."),
              message: detail.message,
            })),
          },
        });
        return;
      }

      const { brandId } = paramValue;

      // Find brand with active status
      const brand = await Brand.findOne({
        _id: brandId,
        status: "active",
      })
        .select("-password -stripeConnectAccountId") // Exclude sensitive fields
        .lean();

      if (!brand) {
        res.status(404).json({
          success: false,
          error: {
            code: "BRAND_001",
            message: "Brand not found or inactive",
          },
        });
        return;
      }

      // Get active classes for this brand
      const classes = await Class.find({
        brand: brandId,
        status: "active",
      })
        .select(
          "name description category difficulty slots duration timeBlocks"
        )
        .sort({ name: 1 })
        .lean();

      // Get class statistics
      const classStats = await Class.aggregate([
        {
          $match: {
            brand: new mongoose.Types.ObjectId(brandId),
            status: "active",
          },
        },
        {
          $group: {
            _id: null,
            totalClasses: { $sum: 1 },
            categories: { $addToSet: "$category" },
            difficulties: { $push: "$difficulty" },
          },
        },
        {
          $project: {
            _id: 0,
            totalClasses: 1,
            uniqueCategories: { $size: "$categories" },
            difficultyDistribution: {
              beginner: {
                $size: {
                  $filter: {
                    input: "$difficulties",
                    cond: { $eq: ["$$this", "beginner"] },
                  },
                },
              },
              intermediate: {
                $size: {
                  $filter: {
                    input: "$difficulties",
                    cond: { $eq: ["$$this", "intermediate"] },
                  },
                },
              },
              advanced: {
                $size: {
                  $filter: {
                    input: "$difficulties",
                    cond: { $eq: ["$$this", "advanced"] },
                  },
                },
              },
            },
          },
        },
      ]);

      const stats = classStats[0] || {
        totalClasses: 0,
        uniqueCategories: 0,
        difficultyDistribution: {
          beginner: 0,
          intermediate: 0,
          advanced: 0,
        },
      };

      res.status(200).json({
        success: true,
        data: {
          brand,
          classes,
          stats,
        },
        message: "Brand details retrieved successfully",
      });
    } catch (error) {
      console.error("Get brand by ID error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "SERVER_001",
          message: "Internal server error",
        },
      });
    }
  }

  /**
   * Browse classes with filtering by category, difficulty, and brand
   * Requirements: 8.3 - WHEN a client browses classes THEN the system SHALL support filtering by category, difficulty, and brand
   */
  public static async getClasses(req: Request, res: Response): Promise<void> {
    try {
      // Validate query parameters
      const { error, value } = classDiscoverySchema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_001",
            message: "Invalid query parameters",
            details: error.details.map((detail) => ({
              field: detail.path.join("."),
              message: detail.message,
            })),
          },
        });
        return;
      }

      const queryParams: ClassDiscoveryQuery = value;

      // Build aggregation pipeline
      const pipeline: any[] = [
        // Match active classes only
        { $match: { status: "active" } },

        // Lookup brand information
        {
          $lookup: {
            from: "brands",
            localField: "brand",
            foreignField: "_id",
            as: "brandInfo",
            pipeline: [
              { $match: { status: "active" } },
              { $project: { name: 1, address: 1, logo: 1 } },
            ],
          },
        },

        // Ensure brand exists and is active
        { $match: { brandInfo: { $ne: [] } } },

        // Unwind brand info
        { $unwind: "$brandInfo" },
      ];

      // Add filters
      const matchConditions: any = {};

      if (queryParams.category) {
        matchConditions.category = queryParams.category;
      }

      if (queryParams.difficulty) {
        matchConditions.difficulty = queryParams.difficulty;
      }

      if (queryParams.brand) {
        matchConditions.brand = new mongoose.Types.ObjectId(queryParams.brand);
      }

      if (queryParams.minDuration || queryParams.maxDuration) {
        matchConditions.duration = {};
        if (queryParams.minDuration) {
          matchConditions.duration.$gte = queryParams.minDuration;
        }
        if (queryParams.maxDuration) {
          matchConditions.duration.$lte = queryParams.maxDuration;
        }
      }

      if (queryParams.city) {
        matchConditions["brandInfo.address.city"] = {
          $regex: queryParams.city,
          $options: "i",
        };
      }

      if (queryParams.state) {
        matchConditions["brandInfo.address.state"] = {
          $regex: queryParams.state,
          $options: "i",
        };
      }

      if (queryParams.search) {
        matchConditions.$or = [
          { name: { $regex: queryParams.search, $options: "i" } },
          { description: { $regex: queryParams.search, $options: "i" } },
          { category: { $regex: queryParams.search, $options: "i" } },
          { "brandInfo.name": { $regex: queryParams.search, $options: "i" } },
        ];
      }

      if (Object.keys(matchConditions).length > 0) {
        pipeline.push({ $match: matchConditions });
      }

      // Add sorting
      const sortField = queryParams.sortBy || "name";
      const sortOrder = queryParams.sortOrder === "desc" ? -1 : 1;
      pipeline.push({ $sort: { [sortField]: sortOrder } });

      // Calculate pagination
      const page = queryParams.page || 1;
      const limit = queryParams.limit || 10;
      const skip = (page - 1) * limit;

      // Add pagination
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });

      // Project final fields
      pipeline.push({
        $project: {
          name: 1,
          description: 1,
          category: 1,
          difficulty: 1,
          slots: 1,
          duration: 1,
          timeBlocks: 1,
          createdAt: 1,
          brand: {
            _id: "$brandInfo._id",
            name: "$brandInfo.name",
            logo: "$brandInfo.logo",
            city: "$brandInfo.address.city",
            state: "$brandInfo.address.state",
          },
        },
      });

      // Execute aggregation and count
      const countPipeline = [...pipeline];
      // Remove skip, limit, and project stages for counting
      const skipIndex = countPipeline.findIndex(
        (stage) => stage.$skip !== undefined
      );
      const limitIndex = countPipeline.findIndex(
        (stage) => stage.$limit !== undefined
      );
      const projectIndex = countPipeline.findIndex(
        (stage) => stage.$project !== undefined
      );

      if (projectIndex !== -1) countPipeline.splice(projectIndex, 1);
      if (limitIndex !== -1) countPipeline.splice(limitIndex, 1);
      if (skipIndex !== -1) countPipeline.splice(skipIndex, 1);

      const [classes, totalCountResult] = await Promise.all([
        Class.aggregate(pipeline),
        Class.aggregate([...countPipeline, { $count: "total" }]),
      ]);

      const totalCount = totalCountResult[0]?.total || 0;

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
            hasPrevPage,
          },
        },
        message: "Classes retrieved successfully",
      });
    } catch (error) {
      console.error("Get classes error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "SERVER_001",
          message: "Internal server error",
        },
      });
    }
  }

  /**
   * Browse sessions with date and availability filtering
   * Requirements: 8.4, 8.5 - WHEN a client views class details THEN the system SHALL display description, schedule, capacity, and pricing options
   * AND session browsing with date and availability filtering
   */
  public static async getSessions(req: Request, res: Response): Promise<void> {
    try {
      // Validate query parameters
      const { error, value } = sessionDiscoverySchema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_001",
            message: "Invalid query parameters",
            details: error.details.map((detail) => ({
              field: detail.path.join("."),
              message: detail.message,
            })),
          },
        });
        return;
      }

      const queryParams: SessionDiscoveryQuery = value;

      // Build aggregation pipeline
      const pipeline: any[] = [
        // Match scheduled sessions in the future
        {
          $match: {
            status: "scheduled",
            dateTime: { $gt: new Date() },
          },
        },

        // Lookup class information
        {
          $lookup: {
            from: "classes",
            localField: "class",
            foreignField: "_id",
            as: "classInfo",
            pipeline: [{ $match: { status: "active" } }],
          },
        },

        // Ensure class exists and is active
        { $match: { classInfo: { $ne: [] } } },

        // Unwind class info
        { $unwind: "$classInfo" },

        // Lookup brand information
        {
          $lookup: {
            from: "brands",
            localField: "classInfo.brand",
            foreignField: "_id",
            as: "brandInfo",
            pipeline: [
              { $match: { status: "active" } },
              { $project: { name: 1, address: 1, logo: 1 } },
            ],
          },
        },

        // Ensure brand exists and is active
        { $match: { brandInfo: { $ne: [] } } },

        // Unwind brand info
        { $unwind: "$brandInfo" },

        // Add available spots calculation
        {
          $addFields: {
            availableSpots: {
              $subtract: ["$capacity", { $size: "$attendees" }],
            },
          },
        },
      ];

      // Add filters
      const matchConditions: any = {};

      if (queryParams.brand) {
        matchConditions["classInfo.brand"] = new mongoose.Types.ObjectId(
          queryParams.brand
        );
      }

      if (queryParams.class) {
        matchConditions.class = new mongoose.Types.ObjectId(queryParams.class);
      }

      if (queryParams.category) {
        matchConditions["classInfo.category"] = queryParams.category;
      }

      if (queryParams.difficulty) {
        matchConditions["classInfo.difficulty"] = queryParams.difficulty;
      }

      if (queryParams.startDate || queryParams.endDate) {
        matchConditions.dateTime = {};
        if (queryParams.startDate) {
          matchConditions.dateTime.$gte = new Date(queryParams.startDate);
        }
        if (queryParams.endDate) {
          const endDate = new Date(queryParams.endDate);
          endDate.setHours(23, 59, 59, 999); // End of day
          matchConditions.dateTime.$lte = endDate;
        }
      }

      if (queryParams.availableOnly) {
        matchConditions.availableSpots = { $gt: 0 };
      }

      if (queryParams.city) {
        matchConditions["brandInfo.address.city"] = {
          $regex: queryParams.city,
          $options: "i",
        };
      }

      if (queryParams.state) {
        matchConditions["brandInfo.address.state"] = {
          $regex: queryParams.state,
          $options: "i",
        };
      }

      if (queryParams.search) {
        matchConditions.$or = [
          { "classInfo.name": { $regex: queryParams.search, $options: "i" } },
          {
            "classInfo.description": {
              $regex: queryParams.search,
              $options: "i",
            },
          },
          {
            "classInfo.category": { $regex: queryParams.search, $options: "i" },
          },
          { "brandInfo.name": { $regex: queryParams.search, $options: "i" } },
        ];
      }

      if (Object.keys(matchConditions).length > 0) {
        pipeline.push({ $match: matchConditions });
      }

      // Add sorting
      const sortField = queryParams.sortBy || "dateTime";
      const sortOrder = queryParams.sortOrder === "desc" ? -1 : 1;
      pipeline.push({ $sort: { [sortField]: sortOrder } });

      // Calculate pagination
      const page = queryParams.page || 1;
      const limit = queryParams.limit || 10;
      const skip = (page - 1) * limit;

      // Add pagination
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });

      // Project final fields
      pipeline.push({
        $project: {
          dateTime: 1,
          capacity: 1,
          availableSpots: 1,
          status: 1,
          createdAt: 1,
          class: {
            _id: "$classInfo._id",
            name: "$classInfo.name",
            description: "$classInfo.description",
            category: "$classInfo.category",
            difficulty: "$classInfo.difficulty",
            duration: "$classInfo.duration",
            cancellationPolicy: "$classInfo.cancellationPolicy",
          },
          brand: {
            _id: "$brandInfo._id",
            name: "$brandInfo.name",
            logo: "$brandInfo.logo",
            city: "$brandInfo.address.city",
            state: "$brandInfo.address.state",
          },
        },
      });

      // Execute aggregation and count
      const countPipeline = [...pipeline];
      // Remove skip, limit, and project stages for counting
      const skipIndex = countPipeline.findIndex(
        (stage) => stage.$skip !== undefined
      );
      const limitIndex = countPipeline.findIndex(
        (stage) => stage.$limit !== undefined
      );
      const projectIndex = countPipeline.findIndex(
        (stage) => stage.$project !== undefined
      );

      if (projectIndex !== -1) countPipeline.splice(projectIndex, 1);
      if (limitIndex !== -1) countPipeline.splice(limitIndex, 1);
      if (skipIndex !== -1) countPipeline.splice(skipIndex, 1);

      const [sessions, totalCountResult] = await Promise.all([
        Session.aggregate(pipeline),
        Session.aggregate([...countPipeline, { $count: "total" }]),
      ]);

      const totalCount = totalCountResult[0]?.total || 0;

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
            hasPrevPage,
          },
        },
        message: "Sessions retrieved successfully",
      });
    } catch (error) {
      console.error("Get sessions error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "SERVER_001",
          message: "Internal server error",
        },
      });
    }
  }

  /**
   * Get available subscription plans for a specific brand
   * Requirements: 8.6 - WHEN a client views subscription plans THEN the system SHALL display active plans with pricing and features
   */
  public static async getBrandSubscriptionPlans(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      // Validate brand ID parameter
      const { error: paramError, value: paramValue } =
        brandIdParamSchema.validate(req.params, {
          abortEarly: false,
          stripUnknown: true,
        });

      if (paramError) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_001",
            message: "Invalid brand ID",
            details: paramError.details.map((detail) => ({
              field: detail.path.join("."),
              message: detail.message,
            })),
          },
        });
        return;
      }

      const { brandId } = paramValue;

      // Verify brand exists and is active
      const brand = await Brand.findOne({
        _id: brandId,
        status: "active",
      })
        .select("name")
        .lean();

      if (!brand) {
        res.status(404).json({
          success: false,
          error: {
            code: "BRAND_001",
            message: "Brand not found or inactive",
          },
        });
        return;
      }

      // Get active subscription plans for this brand
      const subscriptionPlans = await SubscriptionPlan.find({
        brand: brandId,
        status: "active",
      })
        .populate("includedClasses", "name category difficulty")
        .select(
          "name description price billingCycle frequencyLimit includedClasses"
        )
        .sort({ price: 1 })
        .lean();

      res.status(200).json({
        success: true,
        data: {
          brand: {
            _id: brand._id,
            name: brand.name,
          },
          subscriptionPlans: subscriptionPlans.map((plan) => ({
            _id: plan._id,
            name: plan.name,
            description: plan.description,
            price: plan.price,
            priceFormatted: `$${(plan.price / 100).toFixed(2)}`,
            billingCycle: plan.billingCycle,
            frequencyLimit: plan.frequencyLimit,
            includedClasses: plan.includedClasses,
            isUnlimited:
              Array.isArray(plan.includedClasses) &&
              plan.includedClasses.length === 0,
            isUnlimitedFrequency: plan.frequencyLimit.count === 0,
          })),
        },
        message: "Subscription plans retrieved successfully",
      });
    } catch (error) {
      console.error("Get brand subscription plans error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "SERVER_001",
          message: "Internal server error",
        },
      });
    }
  }

  /**
   * Get available credit plans for a specific brand
   * Requirements: 8.7 - WHEN a client views credit plans THEN the system SHALL display active plans with pricing and credit details
   */
  public static async getBrandCreditPlans(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      // Validate brand ID parameter
      const { error: paramError, value: paramValue } =
        brandIdParamSchema.validate(req.params, {
          abortEarly: false,
          stripUnknown: true,
        });

      if (paramError) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_001",
            message: "Invalid brand ID",
            details: paramError.details.map((detail) => ({
              field: detail.path.join("."),
              message: detail.message,
            })),
          },
        });
        return;
      }

      const { brandId } = paramValue;

      // Verify brand exists and is active
      const brand = await Brand.findOne({
        _id: brandId,
        status: "active",
      })
        .select("name")
        .lean();

      if (!brand) {
        res.status(404).json({
          success: false,
          error: {
            code: "BRAND_001",
            message: "Brand not found or inactive",
          },
        });
        return;
      }

      // Get active credit plans for this brand
      const creditPlans = await CreditPlan.find({
        brand: brandId,
        status: "active",
      })
        .populate("includedClasses", "name category difficulty")
        .select(
          "name description price creditAmount validityPeriod bonusCredits includedClasses"
        )
        .sort({ price: 1 })
        .lean();

      res.status(200).json({
        success: true,
        data: {
          brand: {
            _id: brand._id,
            name: brand.name,
          },
          creditPlans: creditPlans.map((plan) => ({
            _id: plan._id,
            name: plan.name,
            description: plan.description,
            price: plan.price,
            priceFormatted: `$${(plan.price / 100).toFixed(2)}`,
            creditAmount: plan.creditAmount,
            bonusCredits: plan.bonusCredits,
            totalCredits: plan.creditAmount + plan.bonusCredits,
            validityPeriod: plan.validityPeriod,
            validityDescription: `${plan.validityPeriod} days`,
            pricePerCredit: Math.round(
              plan.price / (plan.creditAmount + plan.bonusCredits)
            ),
            pricePerCreditFormatted: `$${(
              plan.price /
              (plan.creditAmount + plan.bonusCredits) /
              100
            ).toFixed(2)}`,
            includedClasses: plan.includedClasses,
            isUnlimited:
              Array.isArray(plan.includedClasses) &&
              plan.includedClasses.length === 0,
          })),
        },
        message: "Credit plans retrieved successfully",
      });
    } catch (error) {
      console.error("Get brand credit plans error:", error);
      res.status(500).json({
        success: false,
        error: {
          code: "SERVER_001",
          message: "Internal server error",
        },
      });
    }
  }
}

export default DiscoveryController;
