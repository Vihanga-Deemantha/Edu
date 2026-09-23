import { body } from "express-validator";

/**
 * Shared express-validator chain for an optional `location` field shaped
 * like a GeoJSON Point: `{ type: "Point", coordinates: [lng, lat] }`.
 * Used by any module accepting a client-supplied location (profiles,
 * listings, ...).
 */
export const locationBodyValidator = (field = "location") =>
  body(field)
    .optional()
    .custom((loc) => {
      if (loc === null) return true;
      if (typeof loc !== "object" || Array.isArray(loc)) {
        throw new Error(`${field} must be an object`);
      }
      if (loc.type !== "Point") {
        throw new Error(`${field}.type must be 'Point'`);
      }
      if (!Array.isArray(loc.coordinates) || loc.coordinates.length !== 2) {
        throw new Error(`${field}.coordinates must be an array of [longitude, latitude]`);
      }
      const [lng, lat] = loc.coordinates;
      if (typeof lng !== "number" || lng < -180 || lng > 180) {
        throw new Error(`${field} longitude must be a number between -180 and 180`);
      }
      if (typeof lat !== "number" || lat < -90 || lat > 90) {
        throw new Error(`${field} latitude must be a number between -90 and 90`);
      }
      return true;
    });
