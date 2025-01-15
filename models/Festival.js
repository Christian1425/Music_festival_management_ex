const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Define the schema for a Festival
const festivalSchema = new mongoose.Schema(
  {
    identifier: { type: String, default: uuidv4, unique: true }, // Unique identifier for the festival
    creationDate: { type: Date, default: Date.now }, // Automatic creation date
    name: { type: String, required: true }, // Unique name of the festival
    description: { type: String, required: true }, // Description of the festival
    dates: { type: [Date], required: true }, // Dates for the festival
    venue: { type: String, required: true }, // Venue of the festival
    organizers: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ], // At least one ORGANIZER at creation
    staff: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] },
    ], // STAFF members associated with the festival
    performances: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Performance', default: [] },
    ], // Performances associated with the festival
    venueLayout: { 
      stages: [String],  // Array of stages
      vendorAreas: [String],  // Array of vendor areas
    }, // Optional: Venue layout (e.g., file path or description)
    budget: {
      tracking: { type: Number, default: 0 },
      costs: { type: Number, default: 0 },
      logistics: { type: Number, default: 0 },
      expectedRevenue: { type: Number, default: 0 },
    }, // Optional: Budget details
    vendorManagement: {
      foodStalls: { type: [String] },
      merchandiseBooths: { type: [String] },
    }, // Optional: Vendor management
    state: {
      type: String,
      enum: [
        'CREATED',
        'SUBMISSION',
        'ASSIGNMENT',
        'REVIEW',
        'SCHEDULING',
        'FINAL_SUBMISSION',
        'DECISION',
        'ANNOUNCED',
      ],
      default: 'CREATED',
    }, // State of the festival
  },
  {
    // Schema options
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (doc, ret) => {
        // Exclude identifier
        delete ret.identifier;

        // Rename '_id' to 'id'
        ret.id = ret._id;

        // Exclude '_id'
        delete ret._id;
      },
    },
  }
);

// Create a model for the Festival schema
const Festival = mongoose.model('Festival', festivalSchema);

// Export the Festival model
module.exports = Festival;
