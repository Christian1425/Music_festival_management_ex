const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Define the schema for a Performance
const performanceSchema = new mongoose.Schema(
  {
    identifier: { type: String, default: uuidv4, unique: true }, // Unique identifier for the performance
    creationDate: { type: Date, default: Date.now, required: true }, // Automatic creation date
    name: { type: String, required: true }, // Unique name of the performance
    description: { type: String, required: true }, // Description of the performance
    genre: { type: String, required: true }, // Genre of the performance
    duration: { type: Number, required: true }, // Duration (in minutes)
    bandMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }], // Band members' user IDs
    artists: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }], // List of artist user IDs
    technicalRequirements: {
      equipment: { type: [String], required: false }, // Optional: List of required equipment
      stageSetup: { type: String, required: false }, // Optional: Stage setup description
      soundLighting: { type: String, required: false }, // Optional: Sound and lighting preferences
    }, // Optional: Technical requirements as a structured sub-document
    setlist: { type: [String] }, // Optional: List of planned songs or pieces
    merchandiseItems: [
      {
        name: { type: String, required: true },
        description: { type: String, required: true },
        type: { type: String, required: true },
        price: { type: Number, required: true },
      },
    ], // Optional: Merchandise details
    preferredRehearsalTimes: { type: [String], default: [] }, // Optional: Preferred rehearsal times
    preferredPerformanceSlots: { type: [String], default: [] }, // Optional: Preferred performance time slots
    stageManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Reference to stage manager (STAFF)
    reviewerComments: { type: String, default: null }, // Comments during review
    score: { type: Number, default: null }, // Score during review
    state: {
      type: String,
      enum: ['CREATED', 'SUBMITTED', 'REVIEWED', 'REJECTED', 'APPROVED', 'SCHEDULED','ACCEPTED'],
      default: 'CREATED',
      required: true,
    }, // State of the performance with possible values
    festivalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Festival', // Reference to a single festival
      required: true,
    }, // Reference to the festival this performance belongs to
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

// Define validation for submission
performanceSchema.pre('save', function (next) {
  // Validation before submission
  if (
    this.state === 'SUBMITTED' &&
    (
      !this.technicalRequirements ||
      Object.values(this.technicalRequirements).some(value => !value || (Array.isArray(value) && value.length === 0)) ||
      !this.setlist ||
      this.setlist.length === 0 ||
      !this.merchandiseItems ||
      this.merchandiseItems.length === 0
    )
  ) {
    return next(
      new Error(
        'All optional fields (technical requirements, setlist, merchandise items) must be non-empty when submitting the performance.'
      )
    );
  }

  next();
});

// Create a model for the Performance schema
const Performance = mongoose.model('Performance', performanceSchema);

// Export the Performance model
module.exports = Performance;
