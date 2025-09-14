import mongoose, { Schema, Document } from 'mongoose';

type ObjectId = mongoose.Types.ObjectId;

// Interfaces
export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface ContactInfo {
  phone?: string;
  website?: string;
  socialMedia?: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
  };
}

export interface BusinessHour {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  openTime: string; // Format: "HH:MM"
  closeTime: string; // Format: "HH:MM"
  isClosed: boolean;
}

export interface IBrand extends Document {
  _id: ObjectId;
  name: string;
  email: string;
  password: string;
  description?: string;
  logo?: string;
  address: Address;
  contact: ContactInfo;
  businessHours: BusinessHour[];
  stripeConnectAccountId?: string;
  stripeOnboardingComplete: boolean;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

// Address Schema
const AddressSchema = new Schema<Address>({
  street: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
  zipCode: { type: String, required: true, trim: true },
  country: { type: String, required: true, trim: true, default: 'US' }
}, { _id: false });

// Contact Info Schema
const ContactInfoSchema = new Schema<ContactInfo>({
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
  website: { 
    type: String, 
    trim: true,
    validate: {
      validator: function(v: string) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Website must be a valid URL'
    }
  },
  socialMedia: {
    instagram: { type: String, trim: true },
    facebook: { type: String, trim: true },
    twitter: { type: String, trim: true }
  }
}, { _id: false });

// Business Hours Schema
const BusinessHourSchema = new Schema<BusinessHour>({
  day: { 
    type: String, 
    required: true,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
  },
  openTime: { 
    type: String, 
    required: function(this: BusinessHour) { return !this.isClosed; },
    validate: {
      validator: function(v: string) {
        return !v || /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'Time must be in HH:MM format'
    }
  },
  closeTime: { 
    type: String, 
    required: function(this: BusinessHour) { return !this.isClosed; },
    validate: {
      validator: function(v: string) {
        return !v || /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'Time must be in HH:MM format'
    }
  },
  isClosed: { type: Boolean, default: false }
}, { _id: false });

// Brand Schema
const BrandSchema = new Schema<IBrand>({
  name: { 
    type: String, 
    required: [true, 'Brand name is required'],
    trim: true,
    minlength: [2, 'Brand name must be at least 2 characters'],
    maxlength: [100, 'Brand name cannot exceed 100 characters']
  },
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
  description: { 
    type: String, 
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  logo: { 
    type: String, 
    trim: true,
    validate: {
      validator: function(v: string) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: 'Logo must be a valid URL'
    }
  },
  address: { 
    type: AddressSchema, 
    required: [true, 'Address is required']
  },
  contact: { 
    type: ContactInfoSchema, 
    default: () => ({})
  },
  businessHours: {
    type: [BusinessHourSchema],
    validate: {
      validator: function(hours: BusinessHour[]) {
        const days = hours.map(h => h.day);
        const uniqueDays = new Set(days);
        return days.length === uniqueDays.size;
      },
      message: 'Each day can only appear once in business hours'
    }
  },
  stripeConnectAccountId: { 
    type: String, 
    trim: true
  },
  stripeOnboardingComplete: { 
    type: Boolean, 
    default: false 
  },
  status: { 
    type: String, 
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  timestamps: true,
  toJSON: { 
    transform: function(doc: any, ret: any) {
      delete ret.password;
      return ret;
    }
  }
});

// Indexes
BrandSchema.index({ email: 1 }, { unique: true });
BrandSchema.index({ status: 1 });
BrandSchema.index({ stripeConnectAccountId: 1 }, { sparse: true });

// Pre-save middleware for business hours validation
BrandSchema.pre('save', function(next) {
  // Validate business hours time logic
  for (const hour of this.businessHours) {
    if (!hour.isClosed && hour.openTime && hour.closeTime) {
      const [openHour, openMin] = hour.openTime.split(':').map(Number);
      const [closeHour, closeMin] = hour.closeTime.split(':').map(Number);
      const openMinutes = openHour * 60 + openMin;
      const closeMinutes = closeHour * 60 + closeMin;
      
      if (openMinutes >= closeMinutes) {
        return next(new Error(`Invalid business hours for ${hour.day}: close time must be after open time`));
      }
    }
  }
  next();
});

export const Brand = mongoose.model<IBrand>('Brand', BrandSchema);