const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const User = require('../models/User');
const {Staff} = require('../middleware/Staff'); 
const {Organizer} = require('../middleware/Organizer'); 
const {Artist} = require('../middleware/Artist'); 

router.get('/', (req, res) => {
  res.status(200).json({ message: 'Users retrieved successfully' });
});

// Signup route to create a new user
router.post('/signup', (req, res, next) => {
    const { username, password, fullName, role } = req.body;

    // Check if all required fields are provided
    if (!fullName || !username || !password || !role) {
        return res.status(400).json({
            message: 'Missing required fields: fullName, username, password, or role'
        });
    }

    // Ensure that role is an array and contains only allowed roles
    if (!Array.isArray(role)) {
        return res.status(400).json({
            message: 'Role must be an array of allowed roles'
        });
    }

    const allowedRoles = ['ARTIST', 'ORGANIZER', 'STAFF', 'VISITOR'];

    // Validate roles passed in the array
    if (!role.every(r => allowedRoles.includes(r))) {
        return res.status(400).json({
            message: 'Invalid role(s) in array. Role must be one of: "ARTIST", "ORGANIZER", "VISITOR", "STAFF".'
        });
    }

    // Check if the username already exists
    User.find({ username: username })
        .exec()
        .then(user => {
            if (user.length >= 1) {
                return res.status(409).json({
                    message: 'Username already exists'
                });
            } else {
                // Hash the password and create the new user
                bcrypt.hash(password, 10, (err, hash) => {
                    if (err) {
                        return res.status(500).json({
                            error: err
                        });
                    } else {
                        const newUser = new User({
                            _id: new mongoose.Types.ObjectId(),
                            username: username,
                            password: hash,
                            fullName: fullName,
                            role: role // Multiple roles are now accepted
                        });

                        // Save the user to the database
                        newUser
                            .save()
                            .then(result => {
                                const userResponse = {
                                    id: result._id,
                                    username: result.username,
                                    fullName: result.fullName,
                                    role: result.role
                                };

                                res.status(201).json({
                                    message: 'User created successfully',
                                    user: userResponse
                                });
                            })
                            .catch(err => {
                                console.log(err);
                                res.status(500).json({
                                    error: err
                                });
                            });
                    }
                });
            }
        })
        .catch(err => {
            console.log(err);
            res.status(500).json({
                error: err
            });
        });
});


// Login route for user authentication
router.post('/login', (req, res, next) => {
  User.findOne({ username: req.body.username })
    .exec()
    .then(user => {
      if (!user) {
        console.log('User not found');
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      bcrypt.compare(req.body.password, user.password, (err, result) => {
        if (err) {
          console.log(err);
          return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (result) {
          console.log('Password matched');
          const token = jwt.sign(
            {
              username: user.username,
              _id: user._id,
              roles: Array.isArray(user.role) ? user.role : [user.role], // Always use 'roles' and enforce array
            },
            process.env.JWT_KEY,
            {
              expiresIn: '1h',
            },
          );
          

          return res.status(200).json({
            message: 'Authentication successful',
            token: token
          });
        } else {
          console.log('Password not matched');
          return res.status(401).json({ message: 'Invalid credentials' });
        }
      });
    })
    .catch(err => {
      console.log(err);
      res.status(500).json({ error: err });
    });
});

// Logout route
router.post('/logout',[Organizer,Artist,Staff], async (req, res) => {
  try {
    const userId = req.user._id; // Assuming your authentication middleware sets req.user with user details

    // Clear the user's token in the database
    const user = await User.findById(userId);
    if (user) {
      user.tokens = [];
      await user.save();
    }

    // Clear the user details in the request
    req.user = null;

    res.json({ success: true, message: 'Logout successful' });
  } catch (error) {
    console.error('Logout failed:', error.message);
    res.status(500).json({ success: false, message: 'Logout failed', error: error.message });
  }
});
module.exports = router;