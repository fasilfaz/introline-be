import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { Reminder } from '../models/reminder.model';
import { Customer } from '../models/customer.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';
import { whatsappService } from '../services/whatsapp.service';

export const listReminders = asyncHandler(async (req: Request, res: Response) => {
  const { search, whatsapp } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = {};

  if (whatsapp !== undefined && whatsapp !== 'all') {
    filters.whatsapp = whatsapp === 'true';
  }

  const query = Reminder.find(filters).populate('customer', 'name customerType whatsappNumber');

  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  } else {
    query.sort({ createdAt: -1 });
  }

  query.skip((page - 1) * limit).limit(limit);

  const [reminders, total] = await Promise.all([
    query.exec(),
    Reminder.countDocuments(filters)
  ]);

  // If search is provided, filter results by description or purpose
  let filteredReminders = reminders;
  if (search && typeof search === 'string') {
    filteredReminders = reminders.filter((reminder: any) =>
      reminder.description?.toLowerCase().includes(search.toLowerCase()) ||
      reminder.purpose?.toLowerCase().includes(search.toLowerCase()) ||
      reminder.customerName?.toLowerCase().includes(search.toLowerCase())
    );
  }

  return respond(res, StatusCodes.OK, filteredReminders, buildPaginationMeta(page, limit, total));
});

export const getReminder = asyncHandler(async (req: Request, res: Response) => {
  const reminder = await Reminder.findById(req.params.id).populate('customer', 'name customerType whatsappNumber');

  if (!reminder) {
    throw ApiError.notFound('Reminder not found');
  }

  return respond(res, StatusCodes.OK, reminder);
});

export const createReminder = asyncHandler(async (req: Request, res: Response) => {
  const { date, description, purpose, whatsapp, customerId } = req.body;

  // Validate required fields
  if (!date || !description || !purpose) {
    throw ApiError.badRequest('Date, description, and purpose are required');
  }

  // Validate date
  const reminderDate = new Date(date);
  if (isNaN(reminderDate.getTime())) {
    throw ApiError.badRequest('Invalid date format');
  }

  const reminderData: any = {
    date: reminderDate,
    description: description.trim(),
    purpose: purpose.trim(),
    whatsapp: Boolean(whatsapp)
  };

  // If customer is selected and whatsapp is enabled, fetch customer data
  if (customerId && whatsapp) {
    const customer = await Customer.findById(customerId);

    if (!customer) {
      throw ApiError.badRequest('Selected customer not found');
    }

    if (!customer.whatsappNumber) {
      throw ApiError.badRequest('Selected customer does not have a WhatsApp number');
    }

    reminderData.customer = customer._id;
    reminderData.customerName = customer.name;
    reminderData.customerWhatsappNumber = customer.whatsappNumber;
  } else if (whatsapp && !customerId) {
    throw ApiError.badRequest('Please select a customer to send WhatsApp reminder');
  }

  try {
    const reminder = await Reminder.create(reminderData);

    // Send WhatsApp message if enabled
    if (whatsapp && reminderData.customerWhatsappNumber) {
      const result = await whatsappService.sendReminderMessage(
        reminderData.customerWhatsappNumber,
        {
          purpose: reminder.purpose,
          description: reminder.description,
          date: reminder.date
        }
      );

      if (result.success) {
        reminder.whatsappSent = true;
        reminder.whatsappSentAt = new Date();
        await reminder.save();
        console.log(`✅ WhatsApp reminder sent to ${reminderData.customerName}`);
      } else {
        reminder.whatsappError = result.error;
        await reminder.save();
        console.error(`❌ Failed to send WhatsApp reminder: ${result.error}`);
      }
    }

    return respond(res, StatusCodes.CREATED, reminder, {
      message: whatsapp && reminderData.customerWhatsappNumber
        ? 'Reminder created and WhatsApp notification sent'
        : 'Reminder created successfully'
    });
  } catch (error: any) {
    console.error('Error creating reminder:', error);
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map((err: any) => err.message);
      throw ApiError.badRequest(`Validation failed: ${validationErrors.join(', ')}`);
    }
    throw error;
  }
});

export const updateReminder = asyncHandler(async (req: Request, res: Response) => {
  const reminder = await Reminder.findById(req.params.id);

  if (!reminder) {
    throw ApiError.notFound('Reminder not found');
  }

  const updates: Record<string, unknown> = {};
  const { date, description, purpose, whatsapp, customerId } = req.body;

  if (date !== undefined) {
    const reminderDate = new Date(date);
    if (isNaN(reminderDate.getTime())) {
      throw ApiError.badRequest('Invalid date format');
    }
    updates.date = reminderDate;
  }

  if (description !== undefined) {
    if (!description.trim()) {
      throw ApiError.badRequest('Description cannot be empty');
    }
    updates.description = description.trim();
  }

  if (purpose !== undefined) {
    if (!purpose.trim()) {
      throw ApiError.badRequest('Purpose cannot be empty');
    }
    updates.purpose = purpose.trim();
  }

  if (whatsapp !== undefined) {
    updates.whatsapp = Boolean(whatsapp);
  }

  // Handle customer update
  if (customerId !== undefined) {
    if (customerId) {
      const customer = await Customer.findById(customerId);

      if (!customer) {
        throw ApiError.badRequest('Selected customer not found');
      }

      updates.customer = customer._id;
      updates.customerName = customer.name;
      updates.customerWhatsappNumber = customer.whatsappNumber;
    } else {
      // Clear customer data
      updates.customer = undefined;
      updates.customerName = undefined;
      updates.customerWhatsappNumber = undefined;
    }
  }

  Object.assign(reminder, updates);
  await reminder.save();

  // Send WhatsApp if enabled and customer has WhatsApp number
  if (reminder.whatsapp && reminder.customerWhatsappNumber && !reminder.whatsappSent) {
    const result = await whatsappService.sendReminderMessage(
      reminder.customerWhatsappNumber,
      {
        purpose: reminder.purpose,
        description: reminder.description,
        date: reminder.date
      }
    );

    if (result.success) {
      reminder.whatsappSent = true;
      reminder.whatsappSentAt = new Date();
      reminder.whatsappError = undefined;
      await reminder.save();
      console.log(`✅ WhatsApp reminder sent to ${reminder.customerName}`);
    } else {
      reminder.whatsappError = result.error;
      await reminder.save();
      console.error(`❌ Failed to send WhatsApp reminder: ${result.error}`);
    }
  }

  return respond(res, StatusCodes.OK, reminder, { message: 'Reminder updated successfully' });
});

export const deleteReminder = asyncHandler(async (req: Request, res: Response) => {
  const reminder = await Reminder.findById(req.params.id);

  if (!reminder) {
    throw ApiError.notFound('Reminder not found');
  }

  await Reminder.deleteOne({ _id: reminder._id });

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Reminder deleted successfully' });
});

// New endpoint to send/resend WhatsApp message for a specific reminder
export const sendWhatsAppReminder = asyncHandler(async (req: Request, res: Response) => {
  const reminder = await Reminder.findById(req.params.id);

  if (!reminder) {
    throw ApiError.notFound('Reminder not found');
  }

  if (!reminder.whatsapp) {
    throw ApiError.badRequest('WhatsApp is not enabled for this reminder');
  }

  if (!reminder.customerWhatsappNumber) {
    throw ApiError.badRequest('No WhatsApp number available for this reminder');
  }

  const result = await whatsappService.sendReminderMessage(
    reminder.customerWhatsappNumber,
    {
      purpose: reminder.purpose,
      description: reminder.description,
      date: reminder.date
    }
  );

  if (result.success) {
    reminder.whatsappSent = true;
    reminder.whatsappSentAt = new Date();
    reminder.whatsappError = undefined;
    await reminder.save();

    return respond(res, StatusCodes.OK, reminder, {
      message: 'WhatsApp reminder sent successfully'
    });
  } else {
    reminder.whatsappError = result.error;
    await reminder.save();

    throw ApiError.internal(result.error || 'Failed to send WhatsApp reminder');
  }
});