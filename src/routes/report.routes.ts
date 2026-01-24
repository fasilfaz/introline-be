import { Router } from 'express';
import { query } from 'express-validator';

import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';
import { 
  getPurchaseReport, 
  getStockReport, 
  getSalesReport, 
  getExpenseReport, 
  getPackingListReport,
  getCustomerReport,
  getContainerReport,
  getDeliveryPartnerReport,
  getPickupPartnerReport,
  getBookingReport
} from '../controllers/report.controller';

const router = Router();

router.use(authenticate, authorize(['view_reports']));

// Existing reports
router.get(
  '/purchases',
  [query('from').optional().isISO8601(), query('to').optional().isISO8601()],
  validateRequest,
  getPurchaseReport
);
router.get('/stock', getStockReport);
router.get('/sales', [query('customerId').optional().isMongoId()], validateRequest, getSalesReport);
router.get('/expenses', getExpenseReport);
router.get(
  '/packing-lists',
  [query('from').optional().isISO8601(), query('to').optional().isISO8601()],
  validateRequest,
  getPackingListReport
);

// New report endpoints
router.get(
  '/customers',
  [
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('customerType').optional().isIn(['Sender', 'Receiver', 'all'])
  ],
  validateRequest,
  getCustomerReport
);

router.get(
  '/containers',
  [
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('status').optional().isIn(['pending', 'confirmed', 'completed', 'cancelled', 'all'])
  ],
  validateRequest,
  getContainerReport
);

router.get(
  '/delivery-partners',
  [
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('status').optional().isIn(['Active', 'Inactive', 'all'])
  ],
  validateRequest,
  getDeliveryPartnerReport
);

router.get(
  '/pickup-partners',
  [
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('status').optional().isIn(['Active', 'Inactive', 'all'])
  ],
  validateRequest,
  getPickupPartnerReport
);

router.get(
  '/bookings',
  [
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('status').optional().isIn(['pending', 'success', 'all']),
    query('sender').optional().isMongoId(),
    query('receiver').optional().isMongoId()
  ],
  validateRequest,
  getBookingReport
);

export default router;

