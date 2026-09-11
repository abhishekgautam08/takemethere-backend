import { DayPlan, DayPlanSchema } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateItinerary(itinerary: DayPlan[]): ValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(itinerary) || itinerary.length === 0) {
    errors.push('Itinerary must contain at least one day.');
    return { isValid: false, errors };
  }

  for (const day of itinerary) {
    const parseResult = DayPlanSchema.safeParse(day);
    if (!parseResult.success) {
      errors.push(`Day ${day.day} failed schema validation: ${parseResult.error.message}`);
    }

    // Check for logical activity timings
    if (day.activities && day.activities.length > 0) {
      for (let i = 0; i < day.activities.length; i++) {
        const act = day.activities[i];

        if (isNaN(act.latitude) || isNaN(act.longitude)) {
          errors.push(`Day ${day.day} activity "${act.title}" has invalid coordinates.`);
        }

        if (act.latitude < -90 || act.latitude > 90 || act.longitude < -180 || act.longitude > 180) {
          errors.push(`Day ${day.day} activity "${act.title}" coordinates out of bounds.`);
        }
      }
    }
  }

  if (errors.length > 0) {
    logger.warn('Itinerary validation encountered issues:', errors);
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [] };
}
