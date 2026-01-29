import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';

import { PackingList } from '../models/packing-list.model';
import { Booking } from '../models/booking.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import { buildPaginationMeta } from '../utils/query-builder';
import { Bundle } from '../models/bundle.model';

export const listPackingLists = asyncHandler(async (req: Request, res: Response) => {
  const { packingStatus, search } = req.query;
  const { page, limit, sortBy, sortOrder } = getPaginationParams(req);

  const filters: Record<string, unknown> = {};

  if (packingStatus && packingStatus !== 'all') {
    filters.packingStatus = packingStatus;
  }

  if (search && typeof search === 'string') {
    filters.$or = [
      { packingListCode: new RegExp(search, 'i') },
      { packedBy: new RegExp(search, 'i') }
    ];
  }

  const query = PackingList.find(filters)
    .populate('bookingReference', 'sender receiver pickupPartner date bundleCount status')
    .populate({
      path: 'bookingReference',
      populate: [
        { path: 'sender', select: 'name email' },
        { path: 'receiver', select: 'name email' },
        { path: 'pickupPartner', select: 'name' }
      ]
    });

  if (sortBy) {
    query.sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });
  } else {
    query.sort({ createdAt: -1 });
  }

  query.skip((page - 1) * limit).limit(limit);

  const [lists, total] = await Promise.all([query.exec(), PackingList.countDocuments(filters)]);

  return respond(res, StatusCodes.OK, lists, buildPaginationMeta(page, limit, total));
});

export const createPackingList = asyncHandler(async (req: Request, res: Response) => {
  const { 
    bookingReference, 
    netWeight, 
    grossWeight, 
    packedBy, 
    plannedBundleCount, 
    actualBundleCount, 
    packingStatus,
    mainStatus,
    bundles 
  } = req.body;

  // Validate booking reference exists
  const booking = await Booking.findById(bookingReference);
  if (!booking) {
    throw ApiError.badRequest('Invalid booking reference');
  }

  console.log('Found booking:', booking); // Debug log

  // Check if packing list already exists for this booking
  const existingPackingList = await PackingList.findOne({ bookingReference });
  if (existingPackingList) {
    throw ApiError.conflict('Packing list already exists for this booking');
  }

  console.log('Creating packing list with data:', { // Debug log
    bookingReference,
    netWeight,
    grossWeight,
    packedBy,
    plannedBundleCount,
    actualBundleCount: actualBundleCount || 0,
    packingStatus: packingStatus || 'pending',
    bundles: bundles || []
  });

  const packingList = await PackingList.create({
    bookingReference: new Types.ObjectId(bookingReference),
    netWeight,
    grossWeight,
    packedBy,
    plannedBundleCount,
    actualBundleCount: actualBundleCount || 0,
    packingStatus: packingStatus || 'pending',
    bundles: [] // Initialize with empty array, bundles will be created separately
  });

  console.log('Created packing list:', packingList); // Debug log

  // Create bundles if provided
  if (bundles && Array.isArray(bundles) && bundles.length > 0) {
    const bundleDocs = await Promise.all(
      bundles.map(bundle => 
        Bundle.create({
          packingList: packingList._id,
          bundleNumber: bundle.bundleNumber?.toString() || '', // Ensure bundleNumber is a string
          description: bundle.description,
          quantity: bundle.quantity,
          netWeight: bundle.netWeight,
          grossWeight: bundle.grossWeight,
          actualCount: bundle.actualCount,
          status: bundle.status || 'pending',
          products: bundle.products || []
        })
      )
    );
    packingList.bundles = bundleDocs.map(bundle => bundle._id);
    await packingList.save();
  }

  // Populate the response with booking and bundles
  const populatedPackingList = await PackingList.findById(packingList._id)
    .populate('bookingReference', 'sender receiver pickupPartner date bundleCount status repacking')
    .populate({
      path: 'bookingReference',
      populate: [
        { path: 'sender', select: 'name email' },
        { path: 'receiver', select: 'name email' },
        { path: 'pickupPartner', select: 'name' }
      ]
    })
    .populate('bundles'); // Populate the bundles to return full bundle data in response

  return respond(res, StatusCodes.CREATED, populatedPackingList, { message: 'Packing list created successfully' });
});

export const getPackingList = asyncHandler(async (req: Request, res: Response) => {
  const packingList = await PackingList.findById(req.params.id)
    .populate('bookingReference', 'sender receiver pickupPartner date bundleCount status')
    .populate({
      path: 'bookingReference',
      populate: [
        { path: 'sender', select: 'name email' },
        { path: 'receiver', select: 'name email' },
        { path: 'pickupPartner', select: 'name' }
      ]
    })
    .populate('bundles') // Populate the bundles to return full bundle data
  const populatedPackingList = await packingList;

  if (!populatedPackingList) {
    throw ApiError.notFound('Packing list not found');
  }

  return respond(res, StatusCodes.OK, populatedPackingList);
});

export const updatePackingList = asyncHandler(async (req: Request, res: Response) => {
  const packingList = await PackingList.findById(req.params.id);

  if (!packingList) {
    throw ApiError.notFound('Packing list not found');
  }

  const { 
    bookingReference, 
    netWeight, 
    grossWeight, 
    packedBy, 
    plannedBundleCount, 
    actualBundleCount, 
    packingStatus,
    mainStatus,
    bundles
  } = req.body;

  // If booking reference is being changed, validate it
  if (bookingReference && bookingReference !== packingList.bookingReference.toString()) {
    const booking = await Booking.findById(bookingReference);
    if (!booking) {
      throw ApiError.badRequest('Invalid booking reference');
    }

    // Check if another packing list exists for this booking
    const existingPackingList = await PackingList.findOne({ 
      bookingReference,
      _id: { $ne: packingList._id }
    });
    if (existingPackingList) {
      throw ApiError.conflict('Packing list already exists for this booking');
    }

    packingList.bookingReference = new Types.ObjectId(bookingReference);
  }

  // Update other fields
  if (netWeight !== undefined) packingList.netWeight = netWeight;
  if (grossWeight !== undefined) packingList.grossWeight = grossWeight;
  if (packedBy !== undefined) packingList.packedBy = packedBy;
  if (plannedBundleCount !== undefined) packingList.plannedBundleCount = plannedBundleCount;
  if (actualBundleCount !== undefined) packingList.actualBundleCount = actualBundleCount;
  if (packingStatus !== undefined) packingList.packingStatus = packingStatus;
  if (bundles !== undefined) {
    // Handle bundle updates
    if (Array.isArray(bundles)) {
      // Delete existing bundles for this packing list
      await Bundle.deleteMany({ packingList: packingList._id });
      
      // Create new bundles
      if (bundles.length > 0) {
        const bundleDocs = await Promise.all(
          bundles.map(bundle => 
            Bundle.create({
              packingList: packingList._id,
              bundleNumber: bundle.bundleNumber?.toString() || '', // Ensure bundleNumber is a string
              description: bundle.description,
              quantity: bundle.quantity,
              netWeight: bundle.netWeight,
              grossWeight: bundle.grossWeight,
              actualCount: bundle.actualCount,
              status: bundle.status || 'pending',
              products: bundle.products || []
            })
          )
        );
        packingList.bundles = bundleDocs.map(bundle => bundle._id);
      } else {
        packingList.bundles = [];
      }
    } else {
      packingList.bundles = [];
    }
  }

  await packingList.save();

  // Populate the response with booking and bundles
  const updatedPackingList = await PackingList.findById(packingList._id)
    .populate('bookingReference', 'sender receiver pickupPartner date bundleCount status repacking')
    .populate({
      path: 'bookingReference',
      populate: [
        { path: 'sender', select: 'name email' },
        { path: 'receiver', select: 'name email' },
        { path: 'pickupPartner', select: 'name' }
      ]
    })
    .populate('bundles'); // Populate the bundles to return full bundle data in response

  return respond(res, StatusCodes.OK, updatedPackingList, { message: 'Packing list updated successfully' });
});

export const deletePackingList = asyncHandler(async (req: Request, res: Response) => {
  const packingList = await PackingList.findById(req.params.id);

  if (!packingList) {
    throw ApiError.notFound('Packing list not found');
  }

  // Only allow deletion of pending packing lists
  if (packingList.packingStatus === 'completed') {
    throw ApiError.badRequest('Cannot delete completed packing lists');
  }

  // Delete associated bundles
  await Bundle.deleteMany({ packingList: packingList._id });

  await packingList.deleteOne();

  return respond(res, StatusCodes.OK, { success: true }, { message: 'Packing list deleted successfully' });
});