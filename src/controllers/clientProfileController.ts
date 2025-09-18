import { Request, Response } from 'express';
import { Client } from '../models/Client';
import { clientProfileUpdateSchema } from '../validation/clientAuth';

interface ClientProfileUpdateRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  profilePhoto?: string;
  preferences?: {
    favoriteCategories?: string[];
    preferredDifficulty?: 'beginner' | 'intermediate' | 'advanced';
    notifications?: {
      email?: boolean;
      sms?: boolean;
      push?: boolean;
    };
    timezone?: string;
  };
}

class ClientProfileController {
  /**
   * Get client profile
   */
  public static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const clientId = req.user?.id;

      if (!clientId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_003',
            message: 'Unauthorized access'
          }
        });
        return;
      }

      // Find client by ID
      const client = await Client.findById(clientId);
      
      if (!client) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CLIENT_001',
            message: 'Client not found'
          }
        });
        return;
      }

      // Return client profile (password is automatically excluded by toJSON transform)
      res.status(200).json({
        success: true,
        data: {
          client: client.toJSON()
        },
        message: 'Profile retrieved successfully'
      });

    } catch (error) {
      console.error('Get client profile error:', error);
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
   * Update client profile
   */
  public static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const clientId = req.user?.id;

      if (!clientId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_003',
            message: 'Unauthorized access'
          }
        });
        return;
      }

      // Validate request body
      const { error, value } = clientProfileUpdateSchema.validate(req.body, { 
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

      const updateData: ClientProfileUpdateRequest = value;

      // Find and update client
      const client = await Client.findById(clientId);
      if (!client) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CLIENT_001',
            message: 'Client not found'
          }
        });
        return;
      }

      // Update client fields
      if (updateData.firstName !== undefined) {
        client.firstName = updateData.firstName;
      }
      if (updateData.lastName !== undefined) {
        client.lastName = updateData.lastName;
      }
      if (updateData.phone !== undefined) {
        client.phone = updateData.phone;
      }
      if (updateData.profilePhoto !== undefined) {
        client.profilePhoto = updateData.profilePhoto;
      }
      if (updateData.preferences !== undefined) {
        // Merge preferences with existing ones
        const updatedPreferences = { ...client.preferences };
        
        if (updateData.preferences.favoriteCategories !== undefined) {
          updatedPreferences.favoriteCategories = updateData.preferences.favoriteCategories;
        }
        if (updateData.preferences.preferredDifficulty !== undefined) {
          updatedPreferences.preferredDifficulty = updateData.preferences.preferredDifficulty;
        }
        if (updateData.preferences.timezone !== undefined) {
          updatedPreferences.timezone = updateData.preferences.timezone;
        }
        if (updateData.preferences.notifications !== undefined) {
          updatedPreferences.notifications = {
            email: updateData.preferences.notifications.email ?? client.preferences.notifications?.email ?? true,
            sms: updateData.preferences.notifications.sms ?? client.preferences.notifications?.sms ?? false,
            push: updateData.preferences.notifications.push ?? client.preferences.notifications?.push ?? true
          };
        }
        
        client.preferences = updatedPreferences;
      }

      await client.save();

      // Return updated client profile
      res.status(200).json({
        success: true,
        data: {
          client: client.toJSON()
        },
        message: 'Profile updated successfully'
      });

    } catch (error) {
      console.error('Update client profile error:', error);
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

export default ClientProfileController;