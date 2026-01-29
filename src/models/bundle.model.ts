import { Schema, model, type Document, type Types } from 'mongoose';

export interface BundleDocument extends Document<Types.ObjectId> {
  packingList: Types.ObjectId; // Reference to PackingList
  bundleNumber: string;
  description?: string;
  quantity: number;
  netWeight?: number;
  grossWeight?: number;
  actualCount?: number;
  status: 'pending' | 'in_progress' | 'completed';
  products: Array<{
    id: string;
    productName: string;
    productQuantity: number;
    fabric: string;
    description: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema({
  id: {
    type: String,
    required: true
  },
  productName: {
    type: String,
    required: true,
    trim: true
  },
  productQuantity: {
    type: Number,
    required: true,
    min: 0
  },
  fabric: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  }
}, { _id: false }); // No _id for subdocuments

const bundleSchema = new Schema<BundleDocument>({
  packingList: {
    type: Schema.Types.ObjectId,
    ref: 'PackingList',
    required: true,
    index: true
  },
  bundleNumber: {
    type: String,
    required: true,
    minLength: 1
  },
  description: {
    type: String,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  netWeight: {
    type: Number,
    min: 0
  },
  grossWeight: {
    type: Number,
    min: 0
  },
  actualCount: {
    type: Number,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed'],
    default: 'pending'
  },
  products: [productSchema]
}, {
  timestamps: true
});

// Create indexes for better performance
bundleSchema.index({ packingList: 1, bundleNumber: 1 }, { unique: true });
bundleSchema.index({ status: 1 });
bundleSchema.index({ createdAt: -1 });

// Middleware to validate product data
bundleSchema.pre('save', function (next) {
  if (this.products) {
    // Validate each product has required fields
    for (const product of this.products) {
      if (!product.id || !product.productName) {
        return next(new Error('Each product must have an id and product name'));
      }
      if (product.productQuantity < 0) {
        return next(new Error('Product quantity must be non-negative'));
      }
    }
  }
  next();
});

export const Bundle = model<BundleDocument>('Bundle', bundleSchema);