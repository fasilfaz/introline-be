import mongoose, { Document, Schema } from 'mongoose';

export interface LRNumber {
  lrNumber: string;
  status: 'Collected' | 'Not Collected';
}

export interface IPickupAssign extends Document {
  transportPartnerId: mongoose.Types.ObjectId;
  lrNumbers: LRNumber[];
  assignDate: Date;
  status: 'Pending' | 'Completed';
  createdAt: Date;
  updatedAt: Date;
}

const LRNumberSchema = new Schema<LRNumber>({
  lrNumber: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['Collected', 'Not Collected'],
    default: 'Not Collected',
    required: true
  }
}, { _id: false });

const PickupAssignSchema = new Schema<IPickupAssign>({
  transportPartnerId: {
    type: Schema.Types.ObjectId,
    ref: 'PickupPartner',
    required: true
  },
  lrNumbers: {
    type: [LRNumberSchema],
    required: true,
    validate: {
      validator: function(v: LRNumber[]) {
        return v && v.length > 0;
      },
      message: 'At least one LR number is required'
    }
  },
  assignDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed'],
    default: 'Pending',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual populate for transport partner details
PickupAssignSchema.virtual('transportPartner', {
  ref: 'PickupPartner',
  localField: 'transportPartnerId',
  foreignField: '_id',
  justOne: true
});

// Index for better query performance
PickupAssignSchema.index({ transportPartnerId: 1 });
PickupAssignSchema.index({ assignDate: 1 });
PickupAssignSchema.index({ status: 1 });
PickupAssignSchema.index({ createdAt: -1 });

export const PickupAssign = mongoose.model<IPickupAssign>('PickupAssign', PickupAssignSchema);