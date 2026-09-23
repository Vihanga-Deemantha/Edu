import mongoose from "mongoose";

/**
 * Shared GeoJSON Point sub-schema for any model with an optional location
 * field meant to back a 2dsphere index (TeacherProfile, StudentProfile,
 * Listing, ...).
 *
 * `default: undefined` appears twice on purpose — once on `coordinates`
 * (an Array-type path) and once wherever this is mounted as a parent path
 * (e.g. `location: { type: pointSchema, default: undefined }`). Without
 * both, Mongoose materializes a partial `{ coordinates: [] }` object on
 * every document that never touches location at all — which isn't valid
 * GeoJSON and crashes the 2dsphere index on every insert, not just ones
 * that actually set a location. Found and fixed once in Phase 2
 * (TeacherProfile/StudentProfile); factored out here so it isn't
 * rediscovered a third time.
 */
export const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], required: true },
    coordinates: { type: [Number], required: true, default: undefined },
  },
  { _id: false }
);
