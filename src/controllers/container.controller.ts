import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Container, type ContainerDocument } from '../models/container.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';

// Generate unique container code
const generateContainerCode = async (): Promise<string> => {
  const prefix = 'CNT';
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  
  // Find the last container created in this year-month
  const yearMonthPattern = `${prefix}${year}${month}`;
  
  const lastContainer = await Container.findOne({
    containerCode: { $regex: `^${yearMonthPattern}` }
  }).sort({ containerCode: -1 });
  
  let sequence = 1;
  if (lastContainer && lastContainer.containerCode) {
    const lastSequence = parseInt(lastContainer.containerCode.slice(-4));
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }
  
  return `${yearMonthPattern}${sequence.toString().padStart(4, '0')}`;
};

export const listContainers = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = getPaginationParams(req);
  const { search, status } = req.query;

  // Build filter
  const filter: any = {};
  
  if (search) {
    filter.$or = [
      { containerCode: { $regex: search, $options: 'i' } },
      { companyName: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (status && status !== 'all') {
    filter.status = status;
  }

  // Build sort
  const sort: any = {};
  sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

  const skip = (page - 1) * limit;

  const [containers, total] = await Promise.all([
    Container.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Container.countDocuments(filter)
  ]);

  const totalPages = Math.ceil(total / limit);

  return respond(res, StatusCodes.OK, containers, {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1
  });
});

export const getContainer = asyncHandler(async (req: Request, res: Response) => {
  const container = await Container.findById(req.params.id);
  
  if (!container) {
    throw ApiError.notFound('Container not found');
  }

  return respond(res, StatusCodes.OK, container);
});

export const createContainer = asyncHandler(async (req: Request, res: Response) => {
  const {
    companyName,
    bookingDate,
    bookingCharge,
    advancePayment = 0,
    status = 'pending'
  } = req.body;

  // Generate unique container code with retry logic
  let containerCode: string;
  let attempts = 0;
  const maxAttempts = 5;
  
  do {
    containerCode = await generateContainerCode();
    attempts++;
    
    // Check if this code already exists
    const existingContainer = await Container.findOne({ containerCode });
    if (!existingContainer) {
      break;
    }
    
    if (attempts >= maxAttempts) {
      throw ApiError.badRequest('Unable to generate unique container code after multiple attempts');
    }
    
    // Wait a small amount before retrying
    await new Promise(resolve => setTimeout(resolve, 10));
  } while (attempts < maxAttempts);

  // Calculate balance amount
  const balanceAmount = bookingCharge - advancePayment;

  const container = new Container({
    containerCode,
    companyName,
    bookingDate,
    bookingCharge,
    advancePayment,
    balanceAmount,
    status
  });

  await container.save();

  return respond(res, StatusCodes.CREATED, container);
});

export const updateContainer = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;

  // Remove containerCode from update data as it should not be changed
  delete updateData.containerCode;

  // Calculate balance amount if booking charge or advance payment is being updated
  if (updateData.bookingCharge !== undefined || updateData.advancePayment !== undefined) {
    const currentContainer = await Container.findById(id);
    if (!currentContainer) {
      throw ApiError.notFound('Container not found');
    }

    const bookingCharge = updateData.bookingCharge ?? currentContainer.bookingCharge;
    const advancePayment = updateData.advancePayment ?? currentContainer.advancePayment;
    updateData.balanceAmount = bookingCharge - advancePayment;
  }

  const container = await Container.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  );

  if (!container) {
    throw ApiError.notFound('Container not found');
  }

  return respond(res, StatusCodes.OK, container);
});

export const deleteContainer = asyncHandler(async (req: Request, res: Response) => {
  const container = await Container.findByIdAndDelete(req.params.id);
  
  if (!container) {
    throw ApiError.notFound('Container not found');
  }

  return respond(res, StatusCodes.OK, { success: true });
});