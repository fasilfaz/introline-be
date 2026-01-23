import { Schema, model, type Document, type Types } from 'mongoose';

export interface ReminderDocument extends Document<Types.ObjectId> {
  date: Date;
  description: string;
  purpose: string;
  whatsapp: boolean;
  customer?: Types.ObjectId;
  customerName?: string;
  customerWhatsappNumber?: string;
  whatsappSent?: boolean;
  whatsappSentAt?: Date;
  whatsappError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const reminderSchema = new Schema<ReminderDocument>(
  {
    date: {
      type: Date,
      required: true
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    purpose: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    whatsapp: {
      type: Boolean,
      default: false
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'Customer'
    },
    customerName: {
      type: String,
      trim: true
    },
    customerWhatsappNumber: {
      type: String,
      trim: true
    },
    whatsappSent: {
      type: Boolean,
      default: false
    },
    whatsappSentAt: {
      type: Date
    },
    whatsappError: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Create indexes for better performance
reminderSchema.index({ date: -1 });
reminderSchema.index({ createdAt: -1 });
reminderSchema.index({ whatsapp: 1 });
reminderSchema.index({ customer: 1 });
reminderSchema.index({ whatsappSent: 1 });

export const Reminder = model<ReminderDocument>('Reminder', reminderSchema);