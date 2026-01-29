import { Router } from 'express';
import { body, param, query } from 'express-validator';

import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';
import { 
  listReadyToShipBundles,
  getReadyToShipBundle,
  updateReadyToShipBundle,
  getReadyToShipStats
} from '../controllers/ready-to-ship.controller';

const router = Router();

// Apply authentication and authorization middleware
// Using a permission that makes sense for shipping operations
router.use(authenticate, authorize(['manage_shipping', 'manage_packing', 'admin']));

// GET /ready-to-ship - List all ready to ship bundles (completed status only)
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Search must be between 1 and 100 characters'),
  query('sortField').optional().isIn(['bundleNumber', 'quantity', 'createdAt', 'updatedAt']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
  query('priority').optional().isIn(['high', 'medium', 'low', 'all']).withMessage('Invalid priority filter'),
  query('readyToShipStatus').optional().isIn(['pending', 'stuffed', 'dispatched', 'all']).withMessage('Invalid ready to ship status filter')
], validateRequest, listReadyToShipBundles);

// GET /ready-to-ship/stats - Get statistics for ready to ship bundles
router.get('/stats', getReadyToShipStats);

// GET /ready-to-ship/:id - Get a specific ready to ship bundle
router.get('/:id', [
  param('id').isMongoId().withMessage('Valid bundle ID is required')
], validateRequest, getReadyToShipBundle);

// PUT /ready-to-ship/:id - Update a ready to ship bundle
router.put('/:id', [
  param('id').isMongoId().withMessage('Valid bundle ID is required'),
  body('bundleNumber').optional().trim().isLength({ min: 1 }).withMessage('Bundle number is required'),
  body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters'),
  body('quantity').optional().isFloat({ min: 0 }).withMessage('Quantity must be a positive number'),
  body('netWeight').optional().isFloat({ min: 0 }).withMessage('Net weight must be a positive number'),
  body('grossWeight').optional().isFloat({ min: 0 }).withMessage('Gross weight must be a positive number'),
  body('actualCount').optional().isFloat({ min: 0 }).withMessage('Actual count must be a positive number'),
  body('priority').optional().isIn(['high', 'medium', 'low']).withMessage('Priority must be high, medium, or low'),
  body('readyToShipStatus').optional().isIn(['pending', 'stuffed', 'dispatched']).withMessage('Ready to ship status must be pending, stuffed, or dispatched'),
  body('container').optional().custom((value) => {
    // Allow empty values (undefined, null, empty string) or valid MongoIds
    if (!value || value === '') return true;
    // Simple regex check for ObjectId format
    return /^[0-9a-fA-F]{24}$/.test(value);
  }).withMessage('Container ID must be a valid MongoDB ObjectId when provided'),
  body('products').optional().isArray().withMessage('Products must be an array'),
  body('products.*.id').optional().isString().withMessage('Product ID must be a string'),
  body('products.*.productName').optional().trim().isLength({ min: 1 }).withMessage('Product name is required'),
  body('products.*.productQuantity').optional().isFloat({ min: 0 }).withMessage('Product quantity must be a positive number'),
  body('products.*.fabric').optional().trim().isLength({ max: 100 }).withMessage('Fabric must be less than 100 characters'),
  body('products.*.description').optional().trim().isLength({ max: 500 }).withMessage('Product description must be less than 500 characters')
], validateRequest, updateReadyToShipBundle);

export default router;