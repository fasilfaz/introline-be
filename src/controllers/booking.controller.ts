import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { Booking } from '../models/booking.model';
import { Customer } from '../models/customer.model';
import { PickupPartner } from '../models/pickup-partner.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

export const listBookings = asyncHandler(async (req: Request, res: Response) => {
  const { status, search, sender, receiver } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = {};

  if (status && status !== 'all') {
    filters.status = status;
  }

  if (sender && sender !== 'all') {
    filters.sender = sender;
  }

  if (receiver && receiver !== 'all') {
    filters.receiver = receiver;
  }

  const query = Booking.find(filters)
    .populate('sender', 'name customerType')
    .populate('receiver', 'name customerType branches')
    .populate('pickupPartner', 'name phoneNumber');

  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  } else {
    query.sort({ createdAt: -1 });
  }

  query.skip((page - 1) * limit).limit(limit);

  const [bookings, total] = await Promise.all([
    query.exec(), 
    Booking.countDocuments(filters)
  ]);

  // If search is provided, filter results by sender/receiver names
  let filteredBookings = bookings;
  if (search && typeof search === 'string') {
    filteredBookings = bookings.filter((booking: any) => 
      booking.sender?.name?.toLowerCase().includes(search.toLowerCase()) ||
      booking.receiver?.name?.toLowerCase().includes(search.toLowerCase()) ||
      booking.pickupPartner?.name?.toLowerCase().includes(search.toLowerCase())
    );
  }

  return respond(res, StatusCodes.OK, filteredBookings, buildPaginationMeta(page, limit, total));
});

export const getBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await Booking.findById(req.params.id)
    .populate('sender', 'name customerType location phone whatsappNumber')
    .populate('receiver', 'name customerType branches phone country address')
    .populate('pickupPartner', 'name phoneNumber price');

  if (!booking) {
    throw ApiError.notFound('Booking not found');
  }

  return respond(res, StatusCodes.OK, booking);
});

export const createBooking = asyncHandler(async (req: Request, res: Response) => {
  const { 
    sender,
    receiver,
    receiverBranch,
    pickupPartner,
    date,
    expectedReceivingDate,
    bundleCount,
    status
  } = req.body;

  // Validate required fields
  if (!sender || !receiver || !pickupPartner || !date || !expectedReceivingDate || !bundleCount) {
    throw ApiError.badRequest('All required fields must be provided');
  }

  // Validate that sender exists and is of type 'Sender'
  const senderCustomer = await Customer.findById(sender);
  if (!senderCustomer) {
    throw ApiError.badRequest('Sender customer not found');
  }
  if (senderCustomer.customerType !== 'Sender') {
    throw ApiError.badRequest('Selected sender must be of type "Sender"');
  }

  // Validate that receiver exists and is of type 'Receiver'
  const receiverCustomer = await Customer.findById(receiver);
  if (!receiverCustomer) {
    throw ApiError.badRequest('Receiver customer not found');
  }
  if (receiverCustomer.customerType !== 'Receiver') {
    throw ApiError.badRequest('Selected receiver must be of type "Receiver"');
  }

  // Validate receiver branch if provided
  if (receiverBranch && receiverCustomer.branches && receiverCustomer.branches.length > 0) {
    const branchExists = receiverCustomer.branches.some(
      (branch: any) => branch.branchName === receiverBranch
    );
    if (!branchExists) {
      throw ApiError.badRequest('Selected branch does not exist for this receiver');
    }
  }

  // Validate that pickup partner exists
  const pickupPartnerExists = await PickupPartner.findById(pickupPartner);
  if (!pickupPartnerExists) {
    throw ApiError.badRequest('Pickup partner not found');
  }

  // Validate dates
  const bookingDate = new Date(date);
  const expectedDate = new Date(expectedReceivingDate);
  
  if (expectedDate <= bookingDate) {
    throw ApiError.badRequest('Expected receiving date must be after booking date');
  }

  // Validate bundle count
  if (bundleCount < 1) {
    throw ApiError.badRequest('Bundle count must be at least 1');
  }

  const bookingData = {
    sender,
    receiver,
    receiverBranch: receiverBranch || undefined,
    pickupPartner,
    date: bookingDate,
    expectedReceivingDate: expectedDate,
    bundleCount: Number(bundleCount),
    status: status || 'pending'
  };

  try {
    const booking = await Booking.create(bookingData);
    const populatedBooking = await Booking.findById(booking._id)
      .populate('sender', 'name customerType')
      .populate('receiver', 'name customerType')
      .populate('pickupPartner', 'name phoneNumber');
    
    return respond(res, StatusCodes.CREATED, populatedBooking, { message: 'Booking created successfully' });
  } catch (error: any) {
    console.error('Error creating booking:', error);
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map((err: any) => err.message);
      throw ApiError.badRequest(`Validation failed: ${validationErrors.join(', ')}`);
    }
    throw error;
  }
});

export const updateBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    throw ApiError.notFound('Booking not found');
  }

  const updates: Record<string, unknown> = {};
  const { 
    sender,
    receiver,
    receiverBranch,
    pickupPartner,
    date,
    expectedReceivingDate,
    bundleCount,
    status
  } = req.body;

  // Validate sender if provided
  if (sender !== undefined) {
    const senderCustomer = await Customer.findById(sender);
    if (!senderCustomer) {
      throw ApiError.badRequest('Sender customer not found');
    }
    if (senderCustomer.customerType !== 'Sender') {
      throw ApiError.badRequest('Selected sender must be of type "Sender"');
    }
    updates.sender = sender;
  }

  // Validate receiver if provided
  if (receiver !== undefined) {
    const receiverCustomer = await Customer.findById(receiver);
    if (!receiverCustomer) {
      throw ApiError.badRequest('Receiver customer not found');
    }
    if (receiverCustomer.customerType !== 'Receiver') {
      throw ApiError.badRequest('Selected receiver must be of type "Receiver"');
    }
    updates.receiver = receiver;

    // Validate receiver branch if provided
    if (receiverBranch && receiverCustomer.branches && receiverCustomer.branches.length > 0) {
      const branchExists = receiverCustomer.branches.some(
        (branch: any) => branch.branchName === receiverBranch
      );
      if (!branchExists) {
        throw ApiError.badRequest('Selected branch does not exist for this receiver');
      }
    }
  }

  // Validate pickup partner if provided
  if (pickupPartner !== undefined) {
    const pickupPartnerExists = await PickupPartner.findById(pickupPartner);
    if (!pickupPartnerExists) {
      throw ApiError.badRequest('Pickup partner not found');
    }
    updates.pickupPartner = pickupPartner;
  }

  // Update other fields
  if (receiverBranch !== undefined) updates.receiverBranch = receiverBranch;
  if (date !== undefined) updates.date = new Date(date);
  if (expectedReceivingDate !== undefined) updates.expectedReceivingDate = new Date(expectedReceivingDate);
  if (bundleCount !== undefined) updates.bundleCount = Number(bundleCount);
  if (status !== undefined) updates.status = status;

  // Validate dates if both are being updated
  if (updates.date && updates.expectedReceivingDate) {
    if (updates.expectedReceivingDate <= updates.date) {
      throw ApiError.badRequest('Expected receiving date must be after booking date');
    }
  }

  Object.assign(booking, updates);
  await booking.save();

  const populatedBooking = await Booking.findById(booking._id)
    .populate('sender', 'name customerType')
    .populate('receiver', 'name customerType')
    .populate('pickupPartner', 'name phoneNumber');

  return respond(res, StatusCodes.OK, populatedBooking, { message: 'Booking updated successfully' });
});

export const deleteBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    throw ApiError.notFound('Booking not found');
  }

  await Booking.deleteOne({ _id: booking._id });

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Booking deleted successfully' });
});