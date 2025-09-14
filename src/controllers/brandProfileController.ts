import { Request, Response } from 'express';
import { Brand } from '../models/Brand';
import { brandProfileUpdateSchema } from '../validation/brandAuth';

interface BrandProfileUpdateRequest {
  name?: string;
  description?: string;
  logo?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  contact?: {
    phone?: string;
    website?: string;
    socialMedia?: {
      instagram?: string;
      facebook?: string;
      twitter?: string;
    };
  };
  businessHours?: Array<{
    day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
    openTime?: string;
    closeTime?: string;
    isClosed: boolean;
  }>;
}

class BrandProfileController {
  /**
   * Get brand profile
   */
  public static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const brandId = req.user!.id;

      // Find brand by ID
      const brand = await Brand.findById(brandId);
      if (!brand) {
        res.status(404).json({
          success: false,
          error: {
            code: 'BRAND_001',
            message: 'Brand not found'
          }
        });
        return;
      }

      // Check if brand is active
      if (brand.status !== 'active') {
        res.status(403).json({
          success: false,
          error: {
            code: 'BRAND_002',
            message: 'Brand account is inactive'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          brand: brand.toJSON()
        },
        message: 'Brand profile retrieved successfully'
      });

    } catch (error) {
      console.error('Get brand profile error:', error);
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
   * Update brand profile
   */
  public static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const brandId = req.user!.id;

      // Validate request body
      const { error, value } = brandProfileUpdateSchema.validate(req.body, { 
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

      const updateData: BrandProfileUpdateRequest = value;

      // Find brand by ID
      const brand = await Brand.findById(brandId);
      if (!brand) {
        res.status(404).json({
          success: false,
          error: {
            code: 'BRAND_001',
            message: 'Brand not found'
          }
        });
        return;
      }

      // Check if brand is active
      if (brand.status !== 'active') {
        res.status(403).json({
          success: false,
          error: {
            code: 'BRAND_002',
            message: 'Brand account is inactive'
          }
        });
        return;
      }

      // Update brand fields
      if (updateData.name !== undefined) {
        brand.name = updateData.name;
      }

      if (updateData.description !== undefined) {
        brand.description = updateData.description;
      }

      if (updateData.logo !== undefined) {
        brand.logo = updateData.logo;
      }

      // Update address fields
      if (updateData.address) {
        if (updateData.address.street !== undefined) {
          brand.address.street = updateData.address.street;
        }
        if (updateData.address.city !== undefined) {
          brand.address.city = updateData.address.city;
        }
        if (updateData.address.state !== undefined) {
          brand.address.state = updateData.address.state;
        }
        if (updateData.address.zipCode !== undefined) {
          brand.address.zipCode = updateData.address.zipCode;
        }
        if (updateData.address.country !== undefined) {
          brand.address.country = updateData.address.country;
        }
      }

      // Update contact fields
      if (updateData.contact) {
        if (updateData.contact.phone !== undefined) {
          brand.contact.phone = updateData.contact.phone;
        }
        if (updateData.contact.website !== undefined) {
          brand.contact.website = updateData.contact.website;
        }
        if (updateData.contact.socialMedia) {
          if (!brand.contact.socialMedia) {
            brand.contact.socialMedia = {};
          }
          if (updateData.contact.socialMedia.instagram !== undefined) {
            brand.contact.socialMedia.instagram = updateData.contact.socialMedia.instagram;
          }
          if (updateData.contact.socialMedia.facebook !== undefined) {
            brand.contact.socialMedia.facebook = updateData.contact.socialMedia.facebook;
          }
          if (updateData.contact.socialMedia.twitter !== undefined) {
            brand.contact.socialMedia.twitter = updateData.contact.socialMedia.twitter;
          }
        }
      }

      // Update business hours
      if (updateData.businessHours) {
        brand.businessHours = updateData.businessHours as any;
      }

      // Save updated brand
      await brand.save();

      res.status(200).json({
        success: true,
        data: {
          brand: brand.toJSON()
        },
        message: 'Brand profile updated successfully'
      });

    } catch (error) {
      console.error('Update brand profile error:', error);

      // Handle validation errors from Mongoose
      if (error instanceof Error && error.name === 'ValidationError') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_002',
            message: 'Validation failed',
            details: error.message
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
}

export default BrandProfileController;