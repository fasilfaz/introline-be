import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { PurchaseOrder } from '../models/purchase-order.model';
import { StoreStock } from '../models/store-stock.model';
import { SalesInvoice } from '../models/sales-invoice.model';
import { DailyExpense } from '../models/daily-expense.model';
import { PackingList } from '../models/packing-list.model';
import { Customer } from '../models/customer.model';
import { Container } from '../models/container.model';
import { DeliveryPartner } from '../models/delivery-partner.model';
import { PickupPartner } from '../models/pickup-partner.model';
import { Booking } from '../models/booking.model';
import { ApiError } from '../utils/api-error';
import { asyncHandler } from '../utils/async-handler';
import { respond } from '../utils/api-response';

export const getPurchaseReport = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const { from, to } = req.query;

  // Removed company context - using empty filters object
  const filters: Record<string, unknown> = {};

  if (from || to) {
    filters.orderDate = {};
    if (from) {
      (filters.orderDate as Record<string, Date>).$gte = new Date(from as string);
    }
    if (to) {
      (filters.orderDate as Record<string, Date>).$lte = new Date(to as string);
    }
  }

  const purchaseOrders = await PurchaseOrder.find(filters)
    .populate('supplier', 'name')
    .populate('items.item', 'name code')
    .sort({ orderDate: -1 });

  return respond(res, StatusCodes.OK, purchaseOrders);
});

export const getStockReport = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  // Removed company filter since we're removing company context
  const stock = await StoreStock.find().populate('product', 'name code quantity unitPrice currency status');

  return respond(res, StatusCodes.OK, stock);
});

export const getSalesReport = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  const { customerId } = req.query;

  // Removed company context - using empty filters object
  const filters: Record<string, unknown> = {};

  if (customerId) {
    filters.customer = customerId;
  }

  const invoices = await SalesInvoice.find(filters)
    .populate('customer', 'name')
    .populate('items.item', 'name code')
    .sort({ invoiceDate: -1 });

  return respond(res, StatusCodes.OK, invoices);
});

export const getExpenseReport = asyncHandler(async (req: Request, res: Response) => {
  // Removed company context check since we're removing company context

  // Removed company filter since we're removing company context
  const expenses = await DailyExpense.find().populate('product', 'name code');

  return respond(res, StatusCodes.OK, expenses);
});

export const getPackingListReport = asyncHandler(async (req: Request, res: Response) => {
  const { from, to } = req.query;

  // Build date filters
  const filters: Record<string, unknown> = {};

  if (from || to) {
    filters.createdAt = {};
    if (from) {
      (filters.createdAt as Record<string, Date>).$gte = new Date(from as string);
    }
    if (to) {
      (filters.createdAt as Record<string, Date>).$lte = new Date(to as string);
    }
  }

  const packingLists = await PackingList.find(filters)
    .populate('items.product', 'name code description')
    .populate('store', 'name')
    .populate('toStore', 'name')
    .populate('createdBy', 'firstName lastName')
    .sort({ createdAt: -1 });

  console.log('Packing lists found:', packingLists.length);
  if (packingLists.length > 0) {
    console.log('Sample packing list:', JSON.stringify(packingLists[0], null, 2));
  }

  return respond(res, StatusCodes.OK, packingLists);
});

// New report endpoints for the requested modules

export const getCustomerReport = asyncHandler(async (req: Request, res: Response) => {
  const { from, to, customerType } = req.query;

  // Build date filters
  const filters: Record<string, unknown> = {};

  if (from || to) {
    filters.createdAt = {};
    if (from) {
      (filters.createdAt as Record<string, Date>).$gte = new Date(from as string);
    }
    if (to) {
      (filters.createdAt as Record<string, Date>).$lte = new Date(to as string);
    }
  }

  if (customerType && customerType !== 'all') {
    filters.customerType = customerType;
  }

  const customers = await Customer.find(filters)
    .select('name customerType phone whatsappNumber shopName location country credit paymentHistory status createdAt')
    .sort({ createdAt: -1 });

  // Calculate total amounts for each customer
  const customersWithAmounts = customers.map(customer => {
    let totalAmount = 0;
    let totalCredit = 0;

    if (customer.customerType === 'Receiver' && customer.credit) {
      totalCredit = customer.credit;
    }

    if (customer.customerType === 'Receiver' && customer.paymentHistory) {
      totalAmount = customer.paymentHistory.reduce((sum, payment) => sum + payment.amount, 0);
    }

    return {
      ...customer.toObject(),
      totalAmount,
      totalCredit,
      balanceAmount: totalCredit - totalAmount
    };
  });

  return respond(res, StatusCodes.OK, customersWithAmounts);
});

export const getContainerReport = asyncHandler(async (req: Request, res: Response) => {
  const { from, to, status } = req.query;

  // Build date filters
  const filters: Record<string, unknown> = {};

  if (from || to) {
    filters.bookingDate = {};
    if (from) {
      (filters.bookingDate as Record<string, Date>).$gte = new Date(from as string);
    }
    if (to) {
      (filters.bookingDate as Record<string, Date>).$lte = new Date(to as string);
    }
  }

  if (status && status !== 'all') {
    filters.status = status;
  }

  const containers = await Container.find(filters)
    .sort({ bookingDate: -1 });

  // Calculate totals
  const totals = containers.reduce((acc, container) => {
    acc.totalBookingCharge += container.bookingCharge;
    acc.totalAdvancePayment += container.advancePayment;
    acc.totalBalanceAmount += container.balanceAmount;
    return acc;
  }, {
    totalBookingCharge: 0,
    totalAdvancePayment: 0,
    totalBalanceAmount: 0
  });

  return respond(res, StatusCodes.OK, {
    containers,
    summary: {
      totalContainers: containers.length,
      ...totals
    }
  });
});

export const getDeliveryPartnerReport = asyncHandler(async (req: Request, res: Response) => {
  const { from, to, status } = req.query;

  // Build date filters
  const filters: Record<string, unknown> = {};

  if (from || to) {
    filters.createdAt = {};
    if (from) {
      (filters.createdAt as Record<string, Date>).$gte = new Date(from as string);
    }
    if (to) {
      (filters.createdAt as Record<string, Date>).$lte = new Date(to as string);
    }
  }

  if (status && status !== 'all') {
    filters.status = status;
  }

  const deliveryPartners = await DeliveryPartner.find(filters)
    .sort({ createdAt: -1 });

  // Calculate average price and other metrics
  const summary = deliveryPartners.reduce((acc, partner) => {
    acc.totalPartners += 1;
    acc.totalPrice += partner.price;
    acc.activePartners += partner.status === 'Active' ? 1 : 0;
    return acc;
  }, {
    totalPartners: 0,
    totalPrice: 0,
    activePartners: 0,
    averagePrice: 0
  });

  if (summary.totalPartners > 0) {
    summary.averagePrice = summary.totalPrice / summary.totalPartners;
  }

  return respond(res, StatusCodes.OK, {
    deliveryPartners,
    summary
  });
});

export const getPickupPartnerReport = asyncHandler(async (req: Request, res: Response) => {
  const { from, to, status } = req.query;

  // Build date filters
  const filters: Record<string, unknown> = {};

  if (from || to) {
    filters.createdAt = {};
    if (from) {
      (filters.createdAt as Record<string, Date>).$gte = new Date(from as string);
    }
    if (to) {
      (filters.createdAt as Record<string, Date>).$lte = new Date(to as string);
    }
  }

  if (status && status !== 'all') {
    filters.status = status;
  }

  const pickupPartners = await PickupPartner.find(filters)
    .sort({ createdAt: -1 });

  // Calculate average price and other metrics
  const summary = pickupPartners.reduce((acc, partner) => {
    acc.totalPartners += 1;
    acc.totalPrice += partner.price;
    acc.activePartners += partner.status === 'Active' ? 1 : 0;
    return acc;
  }, {
    totalPartners: 0,
    totalPrice: 0,
    activePartners: 0,
    averagePrice: 0
  });

  if (summary.totalPartners > 0) {
    summary.averagePrice = summary.totalPrice / summary.totalPartners;
  }

  return respond(res, StatusCodes.OK, {
    pickupPartners,
    summary
  });
});

export const getBookingReport = asyncHandler(async (req: Request, res: Response) => {
  const { from, to, status, sender, receiver } = req.query;

  // Build date filters
  const filters: Record<string, unknown> = {};

  if (from || to) {
    filters.date = {};
    if (from) {
      (filters.date as Record<string, Date>).$gte = new Date(from as string);
    }
    if (to) {
      (filters.date as Record<string, Date>).$lte = new Date(to as string);
    }
  }

  if (status && status !== 'all') {
    filters.status = status;
  }

  if (sender && sender !== 'all') {
    filters.sender = sender;
  }

  if (receiver && receiver !== 'all') {
    filters.receiver = receiver;
  }

  const bookings = await Booking.find(filters)
    .populate('sender', 'name customerType phone location')
    .populate('receiver', 'name customerType phone country address')
    .populate('pickupPartner', 'name phoneNumber price')
    .sort({ date: -1 });

  // Calculate summary metrics
  const summary = bookings.reduce((acc, booking: any) => {
    acc.totalBookings += 1;
    acc.totalBundles += booking.bundleCount;
    acc.pendingBookings += booking.status === 'pending' ? 1 : 0;
    acc.successBookings += booking.status === 'success' ? 1 : 0;
    if (booking.pickupPartner?.price) {
      acc.totalPickupCharges += booking.pickupPartner.price;
    }
    return acc;
  }, {
    totalBookings: 0,
    totalBundles: 0,
    pendingBookings: 0,
    successBookings: 0,
    totalPickupCharges: 0
  });

  return respond(res, StatusCodes.OK, {
    bookings,
    summary
  });
});