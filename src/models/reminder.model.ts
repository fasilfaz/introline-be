import { Schema, model, type Document, type Types } from 'mongoose';

export interface ReminderDocument extends Document<Types.ObjectId> {
  date: Date;
  description: string;
  purpose: string;
  whatsapp: boolean;
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

export const Reminder = model<ReminderDocument>('Reminder', reminderSchema);