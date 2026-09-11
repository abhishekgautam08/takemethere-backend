import { Router } from 'express';
import { placeController } from '../controllers/place.controller.js';

export const placeRouter = Router();

placeRouter.get('/destinations', placeController.getPopularDestinations);
placeRouter.get('/reverse-geocode', placeController.reverseGeocode);
placeRouter.get('/autocomplete', placeController.autocomplete);
placeRouter.get('/search', placeController.searchPlaces);
placeRouter.get('/:placeId', placeController.getPlaceDetails);
