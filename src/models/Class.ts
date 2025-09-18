import mongoose, { Schema, Document } from "mongoose";

type ObjectId = mongoose.Types.ObjectId;

// Interfaces
export interface TimeBlock {
  day:
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday";
  startTime: string; // Format: "HH:MM"
  endTime: string; // Format: "HH:MM"
}

export interface IClass extends Document {
  _id: ObjectId;
  name: string;
  brand: ObjectId;
  description: string;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  slots: number;
  duration: number; // minutes
  cancellationPolicy: number; // hours before class
  timeBlocks: TimeBlock[];
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
  isAvailableAt(day: string, time: string): boolean; // Instance method
}

// Time Block Schema
const TimeBlockSchema = new Schema<TimeBlock>(
  {
    day: {
      type: String,
      required: [true, "Day is required"],
      enum: {
        values: [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ],
        message: "Invalid day of week",
      },
    },
    startTime: {
      type: String,
      required: [true, "Start time is required"],
      validate: {
        validator: function (v: string) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: "Start time must be in HH:MM format",
      },
    },
    endTime: {
      type: String,
      required: [true, "End time is required"],
      validate: {
        validator: function (v: string) {
          return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
        },
        message: "End time must be in HH:MM format",
      },
    },
  },
  { _id: false }
);

// Class Schema
const ClassSchema = new Schema<IClass>(
  {
    name: {
      type: String,
      required: [true, "Class name is required"],
      trim: true,
      minlength: [2, "Class name must be at least 2 characters"],
      maxlength: [100, "Class name cannot exceed 100 characters"],
    },
    brand: {
      type: Schema.Types.ObjectId,
      ref: "Brand",
      required: [true, "Brand is required"],
      index: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      minlength: [10, "Description must be at least 10 characters"],
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      lowercase: true,
      minlength: [2, "Category must be at least 2 characters"],
      maxlength: [50, "Category cannot exceed 50 characters"],
    },
    difficulty: {
      type: String,
      required: [true, "Difficulty level is required"],
      enum: {
        values: ["beginner", "intermediate", "advanced"],
        message: "Difficulty must be beginner, intermediate, or advanced",
      },
    },
    slots: {
      type: Number,
      required: [true, "Number of slots is required"],
      min: [1, "Class must have at least 1 slot"],
      max: [100, "Class cannot have more than 100 slots"],
      validate: {
        validator: Number.isInteger,
        message: "Slots must be a whole number",
      },
    },
    duration: {
      type: Number,
      required: [true, "Duration is required"],
      min: [15, "Class duration must be at least 15 minutes"],
      max: [480, "Class duration cannot exceed 8 hours"],
      validate: {
        validator: function (v: number) {
          return Number.isInteger(v) && v % 15 === 0;
        },
        message: "Duration must be a multiple of 15 minutes",
      },
    },
    cancellationPolicy: {
      type: Number,
      required: [true, "Cancellation policy is required"],
      min: [0, "Cancellation policy cannot be negative"],
      max: [168, "Cancellation policy cannot exceed 7 days (168 hours)"],
      default: 24,
      validate: {
        validator: Number.isInteger,
        message: "Cancellation policy must be a whole number of hours",
      },
    },
    timeBlocks: {
      type: [TimeBlockSchema],
      validate: {
        validator: function (blocks: TimeBlock[]) {
          if (blocks.length === 0) return true; // Allow empty for flexible scheduling

          // Check for duplicate day/time combinations
          const combinations = new Set();
          for (const block of blocks) {
            const key = `${block.day}-${block.startTime}-${block.endTime}`;
            if (combinations.has(key)) {
              return false;
            }
            combinations.add(key);
          }
          return true;
        },
        message: "Duplicate time blocks are not allowed",
      },
    },
    status: {
      type: String,
      enum: {
        values: ["active", "inactive"],
        message: "Status must be active or inactive",
      },
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
ClassSchema.index({ brand: 1, status: 1 });
ClassSchema.index({ category: 1, difficulty: 1 });
ClassSchema.index({ brand: 1, name: 1 });
ClassSchema.index({ status: 1 });

// Pre-save middleware for time block validation
ClassSchema.pre("save", function (next) {
  // Validate time blocks
  for (const block of this.timeBlocks) {
    const [startHour, startMin] = block.startTime.split(":").map(Number);
    const [endHour, endMin] = block.endTime.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (startMinutes >= endMinutes) {
      return next(
        new Error(
          `Invalid time block for ${block.day}: end time must be after start time`
        )
      );
    }

    // Check if duration matches time block duration
    const blockDuration = endMinutes - startMinutes;
    if (blockDuration !== this.duration) {
      return next(
        new Error(
          `Time block duration (${blockDuration} minutes) must match class duration (${this.duration} minutes)`
        )
      );
    }
  }
  next();
});

// Instance method to check if class is available on a specific day and time
ClassSchema.methods.isAvailableAt = function (
  day: string,
  time: string
): boolean {
  if (this.status !== "active") return false;

  return this.timeBlocks.some((block: TimeBlock) => {
    if (block.day !== day.toLowerCase()) return false;

    const [timeHour, timeMin] = time.split(":").map(Number);
    const [startHour, startMin] = block.startTime.split(":").map(Number);
    const [endHour, endMin] = block.endTime.split(":").map(Number);

    const timeMinutes = timeHour * 60 + timeMin;
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    return timeMinutes >= startMinutes && timeMinutes < endMinutes;
  });
};

export const Class = mongoose.model<IClass>("Class", ClassSchema);
