import { validationResult } from "express-validator";
import ApiError from "../utils/ApiError.js";

/**
 * Shared validation-result-to-422 middleware. Insert it into a route's
 * middleware chain right after its express-validator chain and before the
 * controller. Replaces an identical local `validate(req)` helper that used
 * to be copy-pasted into every controller file (auth, profiles, listings,
 * verification) — one change to how validation errors are shaped now only
 * needs to happen here.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new ApiError(422, errors.array()[0].msg, "VALIDATION_ERROR");
    err.details = errors.array();
    return next(err);
  }
  next();
};

export default validate;
