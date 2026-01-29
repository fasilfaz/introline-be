import { Router } from 'express';
import { body, param } from 'express-validator';

import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';
import { 
  createBundle,
  deleteBundle,
  getBundle,
  getBundlesByPackingList,
  getBundleStats,
  listBundles,
  updateBundle 
} from '../controllers/bundle.controller';

const router = Router();

router.use(authenticate, authorize(['manage_packing']));

router.get('/', listBundles);

router.get('/packing-list/:id', [param('id').isMongoId()], validateRequest, getBundlesByPackingList);

router.get('/packing-list/:id/stats', [param('id').isMongoId()], validateRequest, getBundleStats);

router.post(
  '/',
  [
    body('packingListId').isMongoId().withMessage('Valid packing list ID is required'),
    
    body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
    body('quantity').isFloat({ min: 0 }).withMessage('Quantity must be a positive number'),
    body('netWeight').optional().isFloat({ min: 0 }).withMessage('Net weight must be a positive number'),
    body('grossWeight').optional().isFloat({ min: 0 }).withMessage('Gross weight must be a positive number'),
    body('actualCount').optional().isFloat({ min: 0 }).withMessage('Actual count must be a positive number'),
    body('status').optional().isIn(['pending', 'in_progress', 'completed']).withMessage('Invalid bundle status'),
    body('products').optional().isArray().withMessage('Products must be an array'),
    body('products.*.id').optional().isString().withMessage('Product ID must be a string'),
    body('products.*.productName').optional().trim().isLength({ min: 1 }).withMessage('Product name is required'),
    body('products.*.productQuantity').optional().isFloat({ min: 0 }).withMessage('Product quantity must be a positive number'),
    body('products.*.fabric').optional().trim().isLength({ max: 100 }).withMessage('Fabric must be less than 100 characters'),
    body('products.*.description').optional().trim().isLength({ max: 500 }).withMessage('Product description must be less than 500 characters')
  ],
  validateRequest,
  createBundle
);

router.get('/:id', [param('id').isMongoId()], validateRequest, getBundle);

router.put(
  '/:id',
  [
    param('id').isMongoId(),
    body('packingListId').optional().isMongoId().withMessage('Valid packing list ID is required'),
    body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
    body('quantity').optional().isFloat({ min: 0 }).withMessage('Quantity must be a positive number'),
    body('netWeight').optional().isFloat({ min: 0 }).withMessage('Net weight must be a positive number'),
    body('grossWeight').optional().isFloat({ min: 0 }).withMessage('Gross weight must be a positive number'),
    body('actualCount').optional().isFloat({ min: 0 }).withMessage('Actual count must be a positive number'),
    body('status').optional().isIn(['pending', 'in_progress', 'completed']).withMessage('Invalid bundle status'),
    body('products').optional().isArray().withMessage('Products must be an array'),
    body('products.*.id').optional().isString().withMessage('Product ID must be a string'),
    body('products.*.productName').optional().trim().isLength({ min: 1 }).withMessage('Product name is required'),
    body('products.*.productQuantity').optional().isFloat({ min: 0 }).withMessage('Product quantity must be a positive number'),
    body('products.*.fabric').optional().trim().isLength({ max: 100 }).withMessage('Fabric must be less than 100 characters'),
    body('products.*.description').optional().trim().isLength({ max: 500 }).withMessage('Product description must be less than 500 characters')
  ],
  validateRequest,
  updateBundle
);

router.delete('/:id', [param('id').isMongoId()], validateRequest, deleteBundle);

export default router;