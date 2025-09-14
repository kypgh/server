import mongoose, { Schema, Document } from 'mongoose';

type ObjectId = mongoose.Types.ObjectId;

// Interfaces
export interface ClientPreferences {
  favoriteCategories?: string[];
  preferredDifficulty?: 'beginner' | 'intermediate' | 'advanced';
  notifications?: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  timezone?: string;
}

export interface IClient extends Document {
  _id: ObjectId;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  profilePhoto?: string;
  preferences: ClientPreferences;
  brands: ObjectId[];
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
  fullName: string; // Virtual property
}

// Client Preferences Schema
const ClientPreferencesSchema = new Schema<ClientPreferences>({
  favoriteCategories: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  preferredDifficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced']
  },
  notifications: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
    push: { type: Boolean, default: true }
  },
  timezone: {
    type: String,
    default: 'UTC',
    validate: {
      validator: function(v: string) {
        // Basic timezone validation - accepts common timezone formats
        return /^[A-Za-z_\/]+$/.test(v) || v === 'UTC';
      },
      message: 'Invalid timezone format'
    }
  }
}, { _id: false });

// Client Schema
const ClientSchema = new Schema<IClient>({
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v: string) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Invalid email format'
    }
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters']
  },
  firstName: { 
    type: String, 
    required: [true, 'First name is required'],
    trim: true,
    minlength: [1, 'First name cannot be empty'],
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: { 
    type: String, 
    required: [true, 'Last name is required'],
    trim: true,
    minlength: [1, 'Last name cannot be empty'],
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  phone: { 
    type: String, 
    trim: true,
    validate: {
      validator: function(v: string) {
        return !v || /^\+?[\d\s\-\(\)]+$/.test(v);
      },
      message: 'Invalid phone number format'
    }
  },
  profilePhoto: { 
    type: String, 
    trim: true,
    validate: {
      validator: function(v: string) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Profile photo must be a valid URL'
    }
  },
  preferences: { 
    type: ClientPreferencesSchema, 
    default: () => ({
      notifications: {
        email: true,
        sms: false,
        push: true
      },
      timezone: 'UTC'
    })
  },
  brands: [{
    type: Schema.Types.ObjectId,
    ref: 'Brand'
  }],
  status: { 
    type: String, 
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc: any, ret: any) {
      delete ret.password;
      return ret;
    }
  }
});

// Indexes
ClientSchema.index({ email: 1 }, { unique: true });
ClientSchema.index({ status: 1 });
ClientSchema.index({ brands: 1 });
ClientSchema.index({ 'preferences.favoriteCategories': 1 });

// Virtual for full name
ClientSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtuals are already included in the schema options above

export const Client = mongoose.model<IClient>('Client', ClientSchema);