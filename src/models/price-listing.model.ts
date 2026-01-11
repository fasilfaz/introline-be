import { Schema, model, type Document, type Types } from 'mongoose';

export interface PriceListingDocument extends Document<Types.ObjectId> {
  fromCountry: string;
  toCountry: string;
  deliveryPartnerId?: Types.ObjectId;
  amount: number;
  totalAmount: number; // amount + delivery charge (if delivery partner selected)
  status: 'Active' | 'Inactive';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const priceListingSchema = new Schema<PriceListingDocument>(
  {
    fromCountry: { type: String, required: true, trim: true, default: 'India' },
    toCountry: { type: String, required: true, trim: true },
    deliveryPartnerId: { type: Schema.Types.ObjectId, ref: 'DeliveryPartner' },
    amount: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    isActive: { type: Boolean, default: true }
  },
  {
    timestamps: true
  }
);

// Create indexes for better performance
priceListingSchema.index({ fromCountry: 1, toCountry: 1 });
priceListingSchema.index({ deliveryPartnerId: 1 });
priceListingSchema.index({ status: 1 });
priceListingSchema.index({ createdAt: -1 });

export const PriceListing = model<PriceListingDocument>('PriceListing', priceListingSchema);