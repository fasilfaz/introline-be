import { Request, Response } from 'express';
import { Container, type ContainerDocument } from '../models/container.model';
import { ApiResponse } from '../types/api-response';

// Generate unique container code
const generateContainerCode = async (): Promise<string> => {
  const prefix = 'CNT';
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  
  // Find the last container created today
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  
  const lastContainer = await Container.findOne({
    createdAt: { $gte: startOfDay, $lt: endOfDay }
  }).sort({ createdAt: -1 });
  
  let sequence = 1;
  if (lastContainer && lastContainer.containerCode) {
    const lastSequence = parseInt(lastContainer.containerCode.slice(-4));
    sequence = lastSequence + 1;
  }
  
  return `${prefix}${year}${month}${sequence.toString().padStart(4, '0')}`;
};

export const listContainers = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

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

    const [containers, total] = await Promise.all([
      Container.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Container.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limitNum);

    const response: ApiResponse<ContainerDocument[]> = {
      success: true,
      data: containers as ContainerDocument[],
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error listing containers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch containers'
    });
  }
};

export const getContainer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const container = await Container.findById(id);
    
    if (!container) {
      return res.status(404).json({
        success: false,
        message: 'Container not found'
      });
    }

    const response: ApiResponse<ContainerDocument> = {
      success: true,
      data: container
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching container:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch container'
    });
  }
};

export const createContainer = async (req: Request, res: Response) => {
  try {
    const {
      companyName,
      bookingDate,
      bookingCharge,
      advancePayment = 0,
      status = 'pending'
    } = req.body;

    // Generate unique container code
    const containerCode = await generateContainerCode();

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

    const response: ApiResponse<ContainerDocument> = {
      success: true,
      data: container,
      message: 'Container created successfully'
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating container:', error);
    
    if (error instanceof Error && error.message.includes('duplicate key')) {
      return res.status(400).json({
        success: false,
        message: 'Container code already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create container'
    });
  }
};

export const updateContainer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove containerCode from update data as it should not be changed
    delete updateData.containerCode;

    // Calculate balance amount if booking charge or advance payment is being updated
    if (updateData.bookingCharge !== undefined || updateData.advancePayment !== undefined) {
      const currentContainer = await Container.findById(id);
      if (!currentContainer) {
        return res.status(404).json({
          success: false,
          message: 'Container not found'
        });
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
      return res.status(404).json({
        success: false,
        message: 'Container not found'
      });
    }

    const response: ApiResponse<ContainerDocument> = {
      success: true,
      data: container,
      message: 'Container updated successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Error updating container:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update container'
    });
  }
};

export const deleteContainer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const container = await Container.findByIdAndDelete(id);
    
    if (!container) {
      return res.status(404).json({
        success: false,
        message: 'Container not found'
      });
    }

    const response: ApiResponse<null> = {
      success: true,
      data: null,
      message: 'Container deleted successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Error deleting container:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete container'
    });
  }
};