import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Types } from 'mongoose';

import { Booking } from '../models/booking.model';
import { Customer } from '../models/customer.model';
import { PickupPartner } from '../models/pickup-partner.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';

// Helper function to generate a unique booking code from sender name, receiver name and date
const generateBookingCode = async (senderName: string, receiverName: string, date: Date): Promise<string> => {
  // Clean the names by removing spaces and special characters, taking first 3 letters of each
  const cleanSender = senderName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
  const cleanReceiver = receiverName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
  
  // Format the date as YYYYMMDD
  const formattedDate = new Date(date).toISOString().split('T')[0].replace(/-/g, '');
  
  // Try to create a booking code and ensure it's unique
  let sequence = 1;
  let bookingCode: string;
  
  do {
    // Pad the sequence number with leading zeros
    const seqStr = sequence.toString().padStart(3, '0');
    
    // Create the booking code: SENDER_RECEIVER_DATE_SEQ
    bookingCode = `${cleanSender}_${cleanReceiver}_${formattedDate}_${seqStr}`;
    
    // Check if this booking code already exists
    const existingBooking = await Booking.findOne({ bookingCode });
    
    if (!existingBooking) {
      return bookingCode; // Return the unique code
    }
    
    sequence++; // Increment sequence and try again
  } while (sequence <= 999); // Limit to 999 tries to avoid infinite loop
  
  // Fallback: use timestamp if all sequences are taken
  const timestamp = Date.now().toString().slice(-6);
  return `${cleanSender}_${cleanReceiver}_${formattedDate}_${timestamp}`;
};

export const listBookings = asyncHandler(async (req: Request, res: Response) => {
  const { status, search, sender, receiver, receiverCountry } = req.query;
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

  // Filter by receiver country if provided
  if (receiverCountry && receiverCountry !== 'all') {
    // We'll handle this in the post-query filtering since receiver.country is nested
  }

  // Execute query without populating pickupPartner first
  const query = Booking.find(filters)
    .populate('sender', 'name customerType')
    .populate('receiver', 'name customerType branches')
    .populate('store', 'name country');

  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  } else {
    query.sort({ createdAt: -1 });
  }

  query.skip((page - 1) * limit).limit(limit);

  const [rawBookings, total] = await Promise.all([
    query.exec(), 
    Booking.countDocuments(filters)
  ]);

  // Manually populate pickupPartner only for valid ObjectIds
  const populatedBookings = await Promise.all(rawBookings.map(async (booking) => {
    // If pickupPartner is a special value ('Self' or 'Central'), keep it as is
    if (booking.pickupPartner === 'Self' || booking.pickupPartner === 'Central') {
      return booking;
    }
    
    // If pickupPartner is a valid ObjectId, populate it
    if (typeof booking.pickupPartner === 'string' && Types.ObjectId.isValid(booking.pickupPartner)) {
      const pickupPartner = await PickupPartner.findById(booking.pickupPartner).select('name phoneNumber');
      (booking as any).pickupPartner = pickupPartner;
    }
    
    return booking;
  }));

  // Apply additional filters after population
  let filteredBookings = populatedBookings;
  
  // Filter by receiver or sender country if provided
  if (receiverCountry && receiverCountry !== 'all') {
    filteredBookings = filteredBookings.filter((booking: any) => {
      const receiverCountryValue = (booking.receiver as any)?.country || '';
      const senderCountryValue = (booking.sender as any)?.country || '';
      const searchCountry = String(receiverCountry).toLowerCase();
      
      return (
        receiverCountryValue.toLowerCase().includes(searchCountry) ||
        senderCountryValue.toLowerCase().includes(searchCountry)
      );
    });
  }
  
  // If search is provided, filter results by sender/receiver names
  if (search && typeof search === 'string') {
    filteredBookings = filteredBookings.filter((booking: any) => 
      booking.sender?.name?.toLowerCase().includes(search.toLowerCase()) ||
      booking.receiver?.name?.toLowerCase().includes(search.toLowerCase()) ||
      ((booking.receiver as any)?.country || '').toLowerCase().includes(search.toLowerCase()) ||
      ((booking.sender as any)?.country || '').toLowerCase().includes(search.toLowerCase()) ||
      (typeof booking.pickupPartner === 'object' && booking.pickupPartner?.name?.toLowerCase().includes(search.toLowerCase()))
    );
  }

  return respond(res, StatusCodes.OK, filteredBookings, buildPaginationMeta(page, limit, total));
});

export const getBooking = asyncHandler(async (req: Request, res: Response) => {
  // Manually populate to handle mixed pickupPartner type
  const booking = await Booking.findById(req.params.id)
    .populate('sender', 'name customerType location phone whatsappNumber')
    .populate('receiver', 'name customerType branches phone country address')
    .populate('store', 'name country');
  
  if (!booking) {
    throw ApiError.notFound('Booking not found');
  }
  
  // Handle pickupPartner separately based on its type
  if (booking.pickupPartner === 'Self' || booking.pickupPartner === 'Central') {
    // Keep as string for special values
    (booking as any).pickupPartner = booking.pickupPartner;
  } else if (Types.ObjectId.isValid(booking.pickupPartner as any)) {
    // Populate if it's a valid ObjectId
    const pickupPartner = await PickupPartner.findById(booking.pickupPartner as any).select('name phoneNumber price');
    (booking as any).pickupPartner = pickupPartner;
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
    status,
    repacking,
    store
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
  // Allow special values 'Self' and 'Central' which don't have object IDs
  if (pickupPartner !== 'Self' && pickupPartner !== 'Central') {
    const pickupPartnerExists = await PickupPartner.findById(pickupPartner);
    if (!pickupPartnerExists) {
      throw ApiError.badRequest('Pickup partner not found');
    }
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

  // Validate repacking status if provided
  if (repacking && !['ready-to-ship', 'repacking-required'].includes(repacking)) {
    throw ApiError.badRequest('Invalid repacking status. Must be "ready-to-ship" or "repacking-required"');
  }

  // Generate booking code using sender name, receiver name and date
  const bookingCode = await generateBookingCode(senderCustomer.name, receiverCustomer.name, bookingDate);
  
  const bookingData = {
    bookingCode,
    sender,
    receiver,
    receiverBranch: receiverBranch || undefined,
    pickupPartner,
    date: bookingDate,
    expectedReceivingDate: expectedDate,
    bundleCount: Number(bundleCount),
    status: status || 'pending',
    repacking: repacking || 'ready-to-ship',
    store: store || undefined
  };

  try {
    const booking = await Booking.create(bookingData);
    
    // Manually populate the booking to handle mixed pickupPartner type
    const rawBooking = await Booking.findById(booking._id)
      .populate('sender', 'name customerType')
      .populate('receiver', 'name customerType')
      .populate('store', 'name country');
    
    if (!rawBooking) {
      throw ApiError.notFound('Booking not found after creation');
    }
    
    // Handle pickupPartner separately based on its type
    const bookingWithAny = rawBooking as any;
    const pickupPartnerValue = bookingWithAny.pickupPartner;
    
    if (pickupPartnerValue === 'Self' || pickupPartnerValue === 'Central') {
      // Keep as string for special values
      bookingWithAny.pickupPartner = pickupPartnerValue;
    } else if (Types.ObjectId.isValid(pickupPartnerValue)) {
      // Populate if it's a valid ObjectId
      const pickupPartner = await PickupPartner.findById(pickupPartnerValue).select('name phoneNumber');
      bookingWithAny.pickupPartner = pickupPartner;
    }
    
    const populatedBooking = rawBooking;
    
    // Add the booking code to the response
    (populatedBooking as any).bookingCode = booking.bookingCode;
    
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
    bookingCode, // We don't allow updating booking code
    sender,
    receiver,
    receiverBranch,
    pickupPartner,
    date,
    expectedReceivingDate,
    bundleCount,
    status,
    repacking,
    store
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
    // Allow special values 'Self' and 'Central' which don't have object IDs
    if (pickupPartner !== 'Self' && pickupPartner !== 'Central') {
      const pickupPartnerExists = await PickupPartner.findById(pickupPartner);
      if (!pickupPartnerExists) {
        throw ApiError.badRequest('Pickup partner not found');
      }
    }
    updates.pickupPartner = pickupPartner;
  }

  // Update other fields
  if (receiverBranch !== undefined) updates.receiverBranch = receiverBranch;
  if (date !== undefined) updates.date = new Date(date);
  if (expectedReceivingDate !== undefined) updates.expectedReceivingDate = new Date(expectedReceivingDate);
  if (bundleCount !== undefined) updates.bundleCount = Number(bundleCount);
  if (status !== undefined) updates.status = status;
  if (repacking !== undefined) {
    // Validate the repacking status value
    if (!['ready-to-ship', 'repacking-required'].includes(repacking)) {
      throw ApiError.badRequest('Invalid repacking status. Must be "ready-to-ship" or "repacking-required"');
    }
    updates.repacking = repacking;
  }
  if (store !== undefined) updates.store = store;

  // Validate dates if both are being updated
  if (updates.date && updates.expectedReceivingDate) {
    if (updates.expectedReceivingDate <= updates.date) {
      throw ApiError.badRequest('Expected receiving date must be after booking date');
    }
  }

  // Don't allow updating booking code, so remove it from updates if present
  if (updates.bookingCode) {
    delete updates.bookingCode;
  }
  
  Object.assign(booking, updates);
  await booking.save();

  // Manually populate to handle mixed pickupPartner type
  const rawBooking = await Booking.findById(booking._id)
    .populate('sender', 'name customerType')
    .populate('receiver', 'name customerType')
    .populate('store', 'name country');
  
  if (!rawBooking) {
    throw ApiError.notFound('Booking not found after update');
  }
  
  // Handle pickupPartner separately based on its type
  if (rawBooking.pickupPartner === 'Self' || rawBooking.pickupPartner === 'Central') {
    // Keep as string for special values
    (rawBooking as any).pickupPartner = rawBooking.pickupPartner;
  } else if (Types.ObjectId.isValid(rawBooking.pickupPartner as any)) {
    // Populate if it's a valid ObjectId
    const pickupPartner = await PickupPartner.findById(rawBooking.pickupPartner as any).select('name phoneNumber');
    (rawBooking as any).pickupPartner = pickupPartner;
  }
  
  const populatedBooking = rawBooking;

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