const jwt = require('jsonwebtoken');
require('dotenv').config();

// Middleware for handling authorization of "ARTIST"
const Staff = (req, res, next) => {
  try {
        // Extract the token from the request headers
    const token = req.headers.authorization && req.headers.authorization.split(' ')[1];

    if (!token) {
            // If token is not provided, return an error response
      console.log('Authorization failed. Token not provided.');
      return res.status(401).json({ message: 'Authorization failed: Token not provided' });
    }
    // Verify the token using the JWT_KEY from the environment variables
    const decodedToken = jwt.verify(token, process.env.JWT_KEY);

    console.log('Decoded Token:', decodedToken);

    // Check if the decoded token has either "ARTIST" or "ORGANIZER" or "STAFF" role
    if (decodedToken.roles && (decodedToken.roles.includes('ARTIST') || decodedToken.roles.includes('ORGANIZER')|| decodedToken.roles.includes('STAFF'))) {
           // If the user has the "ARTIST" or "ORGANIZER" or "STAFF" role, set user details in the request and proceed to the next middleware or route handler
      req.user = {
        username: decodedToken.username,
        _id: decodedToken._id,
        roles: decodedToken.roles
      };

      console.log('Authorization successful.');
      next(); // Proceed to the next middleware or route handler
    } else {
          // If the user does not have the "ARTIST" or "ORGANIZER" or "STAFF" role, return an error response
      console.log('Authorization failed. User does not have the "ARTIST" or "ORGANIZER" or "STAFF" role.');
      return res.status(401).json({ message: 'Authorization failed: Only ARTIST or ORGANIZER or STAFF is allowed' });
    }
  } catch (err) {
    console.error('Error during token verification:', err.message);

    if (err.name === 'TokenExpiredError') {
            // Handle the case where the token has expired
      return res.status(401).json({ message: 'Token expired' });
    } else if (err.name === 'JsonWebTokenError') {
            // Handle the case where the token is invalid
      return res.status(401).json({ message: 'Invalid token' });
    } else {
            // Handle other authentication errors
      console.error('Authentication failed:', err);
      return res.status(401).json({ message: 'Authentication failed' });
    }
  }
};

module.exports = { Staff };
