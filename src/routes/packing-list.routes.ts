import { Router } from 'express';
import { body, param } from 'express-validator';

import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';
import { listPackingLists, createPackingList, getPackingList, updatePackingList, deletePackingList } from '../controllers/packing-list.controller';

const router = Router();

router.use(authenticate, authorize(['manage_packing']));

router.get('/', listPackingLists);

router.post(
  '/',
  [
    body('bookingReference').isMongoId().withMessage('Valid booking reference is required'),
    body('netWeight').isFloat({ min: 0 }).withMessage('Net weight must be a positive number'),
    body('grossWeight').isFloat({ min: 0 }).withMessage('Gross weight must be a positive number'),
    body('packedBy').notEmpty().trim().withMessage('Packed by is required'),
    body('plannedBundleCount').isInt({ min: 0 }).withMessage('Planned bundle count must be a positive integer'),
    body('actualBundleCount').optional().isInt({ min: 0 }).withMessage('Actual bundle count must be a positive integer'),
    body('packingStatus').optional().isIn(['pending', 'in_progress', 'completed']).withMessage('Invalid packing status')
  ],
  validateRequest,
  createPackingList
);

router.get('/:id', [param('id').isMongoId()], validateRequest, getPackingList);

router.put(
  '/:id',
  [
    param('id').isMongoId(),
    body('bookingReference').optional().isMongoId().withMessage('Valid booking reference is required'),
    body('netWeight').optional().isFloat({ min: 0 }).withMessage('Net weight must be a positive number'),
    body('grossWeight').optional().isFloat({ min: 0 }).withMessage('Gross weight must be a positive number'),
    body('packedBy').optional().notEmpty().trim().withMessage('Packed by is required'),
    body('plannedBundleCount').optional().isInt({ min: 0 }).withMessage('Planned bundle count must be a positive integer'),
    body('actualBundleCount').optional().isInt({ min: 0 }).withMessage('Actual bundle count must be a positive integer'),
    body('packingStatus').optional().isIn(['pending', 'in_progress', 'completed']).withMessage('Invalid packing status')
  ],
  validateRequest,
  updatePackingList
);

router.delete('/:id', [param('id').isMongoId()], validateRequest, deletePackingList);

export default router;