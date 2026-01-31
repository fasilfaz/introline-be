import { Schema, model, type Document, type Types } from 'mongoose';

export interface PackingListDocument extends Document<Types.ObjectId> {
  bookingReference: Types.ObjectId; // Reference to Booking
  packingListCode: string; // Auto-generated unique code
  netWeight: number; // Total net weight of packed items
  grossWeight: number; // Total gross weight including packaging
  packedBy: string; // Name of person who completed packing
  plannedBundleCount: number; // Number of bundles planned for packing
  actualBundleCount: number; // Number of bundles packed after completion
  packingStatus: 'pending' | 'in_progress' | 'completed'; // Current status of packing process
  company?: Types.ObjectId; // For legacy index compatibility
  boxNumber?: string; // For legacy index compatibility
  count?: number; // New sequential count
  bundles: Types.ObjectId[]; // Array of bundle references

  createdAt: Date;
  updatedAt: Date;
}

const packingListSchema = new Schema<PackingListDocument>(
  {
    bookingReference: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true
    },
    packingListCode: {
      type: String,
      unique: true,
      trim: true
    },
    netWeight: {
      type: Number,
      required: true,
      min: 0
    },
    grossWeight: {
      type: Number,
      required: true,
      min: 0
    },
    packedBy: {
      type: String,
      trim: true
    },
    plannedBundleCount: {
      type: Number,
      required: true,
      min: 0
    },
    actualBundleCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    packingStatus: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending'
    },
    company: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true
    },
    boxNumber: {
      type: String,
      default: null,
      index: true
    },
    count: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Add the bundles field to the packingListSchema
packingListSchema.add({
  bundles: [{
    type: Schema.Types.ObjectId,
    ref: 'Bundle'
  }]
});

// Create indexes for better performance
packingListSchema.index({ packingListCode: 1 }, { unique: true });
packingListSchema.index({ bookingReference: 1 });
packingListSchema.index({ packingStatus: 1 });
packingListSchema.index({ createdAt: -1 });

// Pre-save middleware to auto-generate packing list code
packingListSchema.pre('save', async function (next) {
  if (this.isNew) {
    try {
      const year = new Date().getFullYear();
      const PackingListModel = this.constructor as any;

      // 1. Generate Global Sequential Count
      if (!this.count) {
        const lastRecord = await PackingListModel.findOne().sort({ count: -1 });
        this.count = (lastRecord?.count || 0) + 1;
      }

      // 2. Generate packingListCode (e.g., PL-2024-001) if not provided
      if (!this.packingListCode) {
        const yearCount = await PackingListModel.countDocuments({
          packingListCode: new RegExp(`^PL-${year}-`)
        });
        this.packingListCode = `PL-${year}-${String(yearCount + 1).padStart(3, '0')}`;
      }

      // 3. Set boxNumber to packingListCode to satisfy legacy unique index { company: 1, boxNumber: 1 }
      // Since company is null/undefined for new records, boxNumber MUST be unique.
      if (!this.boxNumber) {
        this.boxNumber = this.packingListCode;
      }

      console.log('Generated packing list - Code:', this.packingListCode, 'Count:', this.count, 'BoxNumber:', this.boxNumber);
    } catch (error) {
      console.error('Error in packing list pre-save middleware:', error);
      return next(error as Error);
    }
  }
  next();
});

export const PackingList = model<PackingListDocument>('PackingList', packingListSchema);