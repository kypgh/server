import mongoose, { Schema, Document, Model } from 'mongoose';

type ObjectId = mongoose.Types.ObjectId;

// Interfaces
export interface SessionAttendee {
  client: ObjectId;
  bookingType: 'credits' | 'subscription';
  bookingId?: ObjectId;
  status: 'pending' | 'confirmed' | 'attended' | 'no-show';
  joinedAt: Date;
}

export interface ISession extends Document {
  _id: ObjectId;
  class: ObjectId;
  dateTime: Date;
  capacity: number;
  attendees: SessionAttendee[];
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  availableSpots: number; // Virtual property
  
  // Instance methods
  hasCapacity(): boolean;
  getAvailableSpots(): number;
  isClientBooked(clientId: ObjectId): boolean;
  canBeCancelled(): boolean;
}

export interface ISessionModel extends Model<ISession> {
  findAvailable(filters?: any): Promise<any[]>;
}

// Session Attendee Schema
const SessionAttendeeSchema = new Schema<SessionAttendee>({
  client: { 
    type: Schema.Types.ObjectId, 
    ref: 'Client',
    required: [true, 'Client is required']
  },
  bookingType: { 
    type: String, 
    required: [true, 'Booking type is required'],
    enum: {
      values: ['credits', 'subscription'],
      message: 'Booking type must be credits or subscription'
    }
  },
  bookingId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Booking'
  },
  status: { 
    type: String, 
    enum: {
      values: ['pending', 'confirmed', 'attended', 'no-show'],
      message: 'Invalid attendee status'
    },
    default: 'pending'
  },
  joinedAt: { 
    type: Date, 
    default: Date.now 
  }
}, { _id: false });

// Session Schema
const SessionSchema = new Schema<ISession>({
  class: { 
    type: Schema.Types.ObjectId, 
    ref: 'Class',
    required: [true, 'Class is required'],
    index: true
  },
  dateTime: { 
    type: Date, 
    required: [true, 'Date and time is required'],
    validate: {
      validator: function(v: Date) {
        // Session must be in the future when created
        return this.isNew ? v > new Date() : true;
      },
      message: 'Session date and time must be in the future'
    }
  },
  capacity: { 
    type: Number, 
    required: [true, 'Capacity is required'],
    min: [1, 'Session capacity must be at least 1'],
    max: [100, 'Session capacity cannot exceed 100'],
    validate: {
      validator: Number.isInteger,
      message: 'Capacity must be a whole number'
    }
  },
  attendees: {
    type: [SessionAttendeeSchema],
    validate: {
      validator: function(attendees: SessionAttendee[]) {
        // Check capacity constraint
        if (attendees.length > this.capacity) {
          return false;
        }
        
        // Check for duplicate clients
        const clientIds = attendees.map(a => a.client.toString());
        const uniqueClientIds = new Set(clientIds);
        return clientIds.length === uniqueClientIds.size;
      },
      message: 'Session validation failed: capacity exceeded or duplicate bookings'
    }
  },
  status: { 
    type: String, 
    enum: {
      values: ['scheduled', 'in-progress', 'completed', 'cancelled'],
      message: 'Invalid session status'
    },
    default: 'scheduled'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true }
});

// Indexes
SessionSchema.index({ class: 1, dateTime: 1 }, { unique: true }); // Prevent duplicate sessions
SessionSchema.index({ dateTime: 1, status: 1 });
SessionSchema.index({ status: 1 });
SessionSchema.index({ 'attendees.client': 1 });

// Compound index for efficient queries
SessionSchema.index({ class: 1, dateTime: 1, status: 1 });

// Pre-save middleware for capacity validation
SessionSchema.pre('save', async function(next) {
  try {
    // Validate capacity against class slots
    if (this.isModified('class') || this.isModified('capacity')) {
      const Class = mongoose.model('Class');
      const classDoc = await Class.findById(this.class);
      
      if (!classDoc) {
        return next(new Error('Referenced class not found'));
      }
      
      if (this.capacity > classDoc.slots) {
        return next(new Error(`Session capacity (${this.capacity}) cannot exceed class slots (${classDoc.slots})`));
      }
    }
    
    // Validate attendees don't exceed capacity
    if (this.attendees.length > this.capacity) {
      return next(new Error(`Number of attendees (${this.attendees.length}) cannot exceed capacity (${this.capacity})`));
    }
    
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Instance Methods
SessionSchema.methods.hasCapacity = function(): boolean {
  return this.attendees.length < this.capacity;
};

SessionSchema.methods.getAvailableSpots = function(): number {
  return Math.max(0, this.capacity - this.attendees.length);
};

SessionSchema.methods.isClientBooked = function(clientId: ObjectId): boolean {
  return this.attendees.some((attendee: SessionAttendee) => 
    attendee.client.toString() === clientId.toString()
  );
};

SessionSchema.methods.canBeCancelled = function(): boolean {
  const now = new Date();
  const sessionTime = new Date(this.dateTime);
  
  // Can only cancel future sessions that are scheduled
  return sessionTime > now && this.status === 'scheduled';
};

// Static method to find sessions with available capacity
SessionSchema.statics.findAvailable = function(filters: any = {}) {
  return this.aggregate([
    {
      $match: {
        status: 'scheduled',
        dateTime: { $gt: new Date() },
        ...filters
      }
    },
    {
      $addFields: {
        availableSpots: { $subtract: ['$capacity', { $size: '$attendees' }] }
      }
    },
    {
      $match: {
        availableSpots: { $gt: 0 }
      }
    }
  ]);
};

// Virtual for available spots
SessionSchema.virtual('availableSpots').get(function() {
  return this.getAvailableSpots();
});

// Virtuals are already included in the schema options above

export const Session = mongoose.model<ISession, ISessionModel>('Session', SessionSchema);