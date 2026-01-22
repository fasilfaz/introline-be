import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { Reminder } from '../models/reminder.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

export const listReminders = asyncHandler(async (req: Request, res: Response) => {
  const { search, whatsapp } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = {};

  if (whatsapp !== undefined && whatsapp !== 'all') {
    filters.whatsapp = whatsapp === 'true';
  }

  const query = Reminder.find(filters);

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
      reminder.purpose?.toLowerCase().includes(search.toLowerCase())
    );
  }

  return respond(res, StatusCodes.OK, filteredReminders, buildPaginationMeta(page, limit, total));
});

export const getReminder = asyncHandler(async (req: Request, res: Response) => {
  const reminder = await Reminder.findById(req.params.id);

  if (!reminder) {
    throw ApiError.notFound('Reminder not found');
  }

  return respond(res, StatusCodes.OK, reminder);
});

export const createReminder = asyncHandler(async (req: Request, res: Response) => {
  const { date, description, purpose, whatsapp } = req.body;

  // Validate required fields
  if (!date || !description || !purpose) {
    throw ApiError.badRequest('Date, description, and purpose are required');
  }

  // Validate date
  const reminderDate = new Date(date);
  if (isNaN(reminderDate.getTime())) {
    throw ApiError.badRequest('Invalid date format');
  }

  const reminderData = {
    date: reminderDate,
    description: description.trim(),
    purpose: purpose.trim(),
    whatsapp: Boolean(whatsapp)
  };

  try {
    const reminder = await Reminder.create(reminderData);
    
    return respond(res, StatusCodes.CREATED, reminder, { message: 'Reminder created successfully' });
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
  const { date, description, purpose, whatsapp } = req.body;

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

  Object.assign(reminder, updates);
  await reminder.save();

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