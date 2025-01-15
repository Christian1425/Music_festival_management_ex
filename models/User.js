const mongoose = require('mongoose');

// Define the schema for a User
const userSchema = mongoose.Schema(
  {
    username: {
      type: String,
      unique: true, // Ensure username uniqueness
      required: true,
    },
    password: {
      type: String,
      required: true, // Password is required
    },
    fullName: {
      type: String,
      required: true, // Full name is required
    },
    role: {
      type: [String], // Role can be an array of strings
      enum: ['ARTIST', 'ORGANIZER', 'VISITOR', 'STAFF'], // Allowed roles
      required: true,
    },
  },
  {
    // Schema options
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (doc, ret) => {
        ret.id = ret._id;

        // Remove '_id' and 'password' fields
        delete ret._id;
        delete ret.password;
      },
    },
  }
);

// Validation to ensure that the roles are valid
userSchema.pre('save', function (next) {
  const allowedRoles = ['ARTIST', 'ORGANIZER', 'VISITOR', 'STAFF'];

  // Check if all roles are valid
  if (this.role.some(role => !allowedRoles.includes(role))) {
    return next(new Error('Invalid role. Role must be one of: "ARTIST", "ORGANIZER", "VISITOR", "STAFF".'));
  }

  next();
});

// Create a model for the User schema
const User = mongoose.model('User', userSchema);

// Export the User model
module.exports = User;
