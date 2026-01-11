import { Router } from 'express';
import { body, param } from 'express-validator';

import { listPriceListings, getPriceListing, createPriceListing, updatePriceListing, deletePriceListing } from '../controllers/price-listing.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate-request';

const router = Router();

// router.use(authenticate, authorize(['manage_price_listings']));

router.get('/', listPriceListings);

router.get('/:id', [param('id').isMongoId()], validateRequest, getPriceListing);

router.post(
  '/',
  [
    body('fromCountry').notEmpty().withMessage('From country is required'),
    body('toCountry').notEmpty().withMessage('To country is required'),
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('deliveryPartnerId').optional().isMongoId().withMessage('Invalid delivery partner ID'),
    body('status').optional().isIn(['Active', 'Inactive']).withMessage('Status must be Active or Inactive')
  ],
  validateRequest,
  createPriceListing
);

router.put('/:id', [param('id').isMongoId()], validateRequest, updatePriceListing);

router.delete('/:id', [param('id').isMongoId()], validateRequest, deletePriceListing);

export default router;