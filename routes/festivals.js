const express = require('express');
const router = express.Router();
const Festival = require('../models/Festival');
const Performance = require('../models/Performance'); 
const User = require('../models/User');
const {Staff} = require('../middleware/Staff'); 
const {Organizer} = require('../middleware/Organizer'); 
const {Artist} = require('../middleware/Artist'); 

router.get('/', (req, res) => {
  res.status(200).json({ message: 'Festivals retrieved successfully' });
});

router.post('/', (req, res) => {
  // Simulate a server error
  throw new Error('Simulated server error');
});
// Endpoint for creating a new festival
router.post('/create', Organizer, async (req, res) => {
  try {
    // Extract required fields from the request body
    const { name, description, dates, venue, organizers, staff, venueLayout, budget, vendorManagement } = req.body;

    // Validate obligatory fields
    if (!name || !description || !dates || !venue || !organizers || organizers.length === 0) {
      return res.status(400).json({ error: 'All obligatory fields must be provided: name, description, dates, venue, and at least one organizer.' });
    }

    // Check if the festival name is unique
    const existingFestival = await Festival.findOne({ name });
    if (existingFestival) {
      return res.status(400).json({ error: 'Festival name must be unique.' });
    }

    // Validate that all organizers are users with the "ORGANIZER" role
    const invalidOrganizers = [];
    for (const organizerId of organizers) {
      const user = await User.findById(organizerId);

      // Check if the user exists and has the "ORGANIZER" role
      if (!user || !user.role || !user.role.includes('ORGANIZER')) {
        invalidOrganizers.push(organizerId);
      }
    }

    if (invalidOrganizers.length > 0) {
      return res.status(400).json({ 
        error: `The following organizers are invalid or do not have the "ORGANIZER" role: ${invalidOrganizers.join(', ')}` 
      });
    }

    // Validate that all staff (if provided) are users with the "STAFF" role
    const invalidStaff = [];
    if (staff && staff.length > 0) {
      for (const staffId of staff) {
        const user = await User.findById(staffId);

        // Check if the user exists and has the "STAFF" role
        if (!user || !user.role || !user.role.includes('STAFF')) {
          invalidStaff.push(staffId);
        }
      }

      if (invalidStaff.length > 0) {
        return res.status(400).json({ 
          error: `The following staff are invalid or do not have the "STAFF" role: ${invalidStaff.join(', ')}` 
        });
      }
    }

    // Create a new festival
    const newFestival = new Festival({
      name,
      description,
      dates,
      venue,
      organizers,  // List of organizer user IDs
      staff,  // List of staff user IDs (optional)
      venueLayout: venueLayout || null, // Optional field
      budget: budget || null, // Optional field
      vendorManagement: vendorManagement || null, // Optional field
    });

    // Save the festival to the database
    const savedFestival = await newFestival.save();

    // Respond with the created festival details
    return res.status(201).json(savedFestival);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Endpoint for updating an existing festival
router.put('/:festivalId', Organizer, async (req, res) => {
    try {
      const festivalId = req.params.festivalId; // Get festival ID from route parameters
      const {
        name,
        description,
        dates,
        venueLayout,
        budget,
        vendorManagement,
        staff,
        organizers,
      } = req.body;
  
      // Find the festival by its ID
      const festival = await Festival.findById(festivalId);
      if (!festival) {
        return res.status(404).json({ error: 'Festival not found.' });
      }
  
      // Check if the festival is in the 'ANNOUNCED' state (no updates allowed after this state)
      if (festival.state === 'ANNOUNCED') {
        return res.status(400).json({ error: 'Festival cannot be updated once it is announced.' });
      }
  
      // Ensure venue, budget, and vendor-related updates are completed before the festival reaches the 'ANNOUNCED' state
      if (festival.state === 'ASSIGNMENT' && (
        !festival.venueLayout || 
        !festival.budget || 
        Object.values(festival.budget).some(value => value === 0) || 
        !festival.vendorManagement || 
        !festival.vendorManagement.foodStalls.length || 
        !festival.vendorManagement.merchandiseBooths.length)) {
        
        return res.status(400).json({
          error: 'Venue layout, budget, and vendor management must be completed before the festival reaches the ANNOUNCED state.'
        });
      }
  
      // If organizers are being updated, validate their roles
      if (organizers && organizers.length > 0) {
        const invalidOrganizers = [];
        for (const organizerId of organizers) {
          const user = await User.findById(organizerId);
          if (!user || !user.role || !user.role.includes('ORGANIZER')) {
            invalidOrganizers.push(organizerId);
          }
        }
        if (invalidOrganizers.length > 0) {
          return res.status(400).json({
            error: `The following organizers are invalid or do not have the "ORGANIZER" role: ${invalidOrganizers.join(', ')}`
          });
        }
      }
  
      // If staff are being updated, validate their roles
      if (staff && staff.length > 0) {
        const invalidStaff = [];
        for (const staffId of staff) {
          const user = await User.findById(staffId);
          if (!user || !user.role || !user.role.includes('STAFF')) {
            invalidStaff.push(staffId);
          }
        }
        if (invalidStaff.length > 0) {
          return res.status(400).json({
            error: `The following staff are invalid or do not have the "STAFF" role: ${invalidStaff.join(', ')}`
          });
        }
      }
  
      // Update festival details
      if (name) festival.name = name;
      if (description) festival.description = description;
      if (dates) festival.dates = dates;
      if (venueLayout) festival.venueLayout = venueLayout;
      if (budget) festival.budget = budget;
      if (vendorManagement) festival.vendorManagement = vendorManagement;
      if (staff) festival.staff = staff;
      if (organizers) festival.organizers = organizers;
  
      // Save the updated festival
      const updatedFestival = await festival.save();
  
      // Return the updated festival in the response
      return res.status(200).json(updatedFestival);
  
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });


// Route to add organizers to a festival
router.put('/:festivalId/add-organizers',  Organizer,async (req, res) => {
    try {
      const festivalId = req.params.festivalId; // Get festival ID from the route parameters
      const { organizers } = req.body; // List of user IDs to add as organizers
  
      // Validate that organizers array is provided
      if (!organizers || organizers.length === 0) {
        return res.status(400).json({ error: 'Please provide at least one user ID to add as an organizer.' });
      }
  
      // Find the festival by its ID
      const festival = await Festival.findById(festivalId);
      if (!festival) {
        return res.status(404).json({ error: 'Festival not found.' });
      }
  
      // Ensure the provided users are valid and have the "ORGANIZER" role
      const invalidOrganizers = [];
      const newOrganizers = [];
      
      for (const organizerId of organizers) {
        const user = await User.findById(organizerId);
        
        // Check if the user exists
        if (!user) {
          invalidOrganizers.push(organizerId);
          continue;
        }
  
        // Ensure the user does not already have the "ORGANIZER" role for the festival
        if (festival.organizers.includes(organizerId)) {
          continue; // Skip this user as they are already an organizer
        }
  
        // Add the user to the list of new organizers if they are valid
        newOrganizers.push(organizerId);
        
        // Check if the user has the "ORGANIZER" role
        if (!user.role || !user.role.includes('ORGANIZER')) {
          invalidOrganizers.push(organizerId);
        }
      }
  
      // If any users are invalid, respond with an error
      if (invalidOrganizers.length > 0) {
        return res.status(400).json({
          error: `The following users are either invalid or do not have the "ORGANIZER" role: ${invalidOrganizers.join(', ')}`
        });
      }
  
      // Add the new organizers to the festival's organizers list
      festival.organizers.push(...newOrganizers);
      
      // Save the updated festival
      const updatedFestival = await festival.save();
  
      // Return the updated festival in the response
      res.status(200).json(updatedFestival);
      
    } catch (error) {
      console.error('Error adding organizers:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  

// Route to add staff to a festival
router.put('/:festivalId/add-staff', Organizer, async (req, res) => {
    try {
      const festivalId = req.params.festivalId; // Get festival ID from the route parameters
      const { staff } = req.body; // List of user IDs to add as staff
  
      // Validate that staff array is provided
      if (!staff || staff.length === 0) {
        return res.status(400).json({ error: 'Please provide at least one user ID to add as staff.' });
      }
  
      // Find the festival by its ID
      const festival = await Festival.findById(festivalId);
      if (!festival) {
        return res.status(404).json({ error: 'Festival not found.' });
      }
  
      // Ensure the provided users are valid and have the "STAFF" role
      const invalidStaff = [];
      const newStaffMembers = [];
      
      for (const staffId of staff) {
        const user = await User.findById(staffId);
        
        // Check if the user exists
        if (!user) {
          invalidStaff.push(staffId);
          continue;
        }
  
        // Ensure the user does not already have the "STAFF" role for the festival
        if (festival.staff.includes(staffId)) {
          continue; // Skip this user as they are already a staff member
        }
  
        // Add the user to the list of new staff members if they are valid
        newStaffMembers.push(staffId);
        
        // Check if the user has the "STAFF" role
        if (!user.role || !user.role.includes('STAFF')) {
          invalidStaff.push(staffId);
        }
      }
  
      // If any users are invalid, respond with an error
      if (invalidStaff.length > 0) {
        return res.status(400).json({
          error: `The following users are either invalid or do not have the "STAFF" role: ${invalidStaff.join(', ')}`
        });
      }
  
      // Add the new staff members to the festival's staff list
      festival.staff.push(...newStaffMembers);
      
      // Save the updated festival
      const updatedFestival = await festival.save();
  
      // Return the updated festival in the response
      res.status(200).json(updatedFestival);
      
    } catch (error) {
      console.error('Error adding staff:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });


// Route for deleting a festival by its ID
router.delete('/:festivalId', Organizer, async (req, res) => {
    try {
      const { festivalId } = req.params; // Extract festival ID from URL parameters
  
      // Find the festival by its ID
      const festival = await Festival.findById(festivalId);
  
      if (!festival) {
        return res.status(404).json({ error: 'Festival not found' });
      }
  
      // Check if the festival is in the 'CREATED' state
      if (festival.state !== 'CREATED') {
        return res.status(400).json({ error: 'Festival can only be deleted in the "CREATED" state' });
      }
  
  
      // Delete the festival
      await Festival.deleteOne({ _id: festivalId });
  
      // Respond with a success message
      return res.status(200).json({ message: 'Festival deleted successfully' });
    } catch (error) {
      console.error('Error deleting festival:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  
  
// Route for starting performance submissions for a festival
router.post('/:festivalId/start-submission', Organizer, async (req, res) => {
    try {
      const { festivalId } = req.params; // Extract festival ID from URL parameters
  
      // Find the festival by its ID
      const festival = await Festival.findById(festivalId);
  
      if (!festival) {
        return res.status(404).json({ error: 'Festival not found' });
      }
  
      // Check if the festival is in the 'CREATED' state
      if (festival.state !== 'CREATED') {
        return res.status(400).json({ error: 'Festival must be in "CREATED" state to start submissions' });
      }
  
  
      // Update the festival state to 'SUBMISSION'
      festival.state = 'SUBMISSION';
  
      // Save the updated festival
      const updatedFestival = await festival.save();
  
      // Respond with the updated festival details
      return res.status(200).json(updatedFestival);
    } catch (error) {
      console.error('Error starting submission for festival:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });


// Route to start stage manager assignment
router.post('/start-assignment/:festivalId',  Organizer,async (req, res) => {
    try {
      const { festivalId } = req.params;
  
      // Find the festival by ID
      const festival = await Festival.findById(festivalId);
      if (!festival) {
        return res.status(404).json({ error: 'Festival not found.' });
      }
  
      // Check if the festival is in the SUBMISSION state
      if (festival.state !== 'SUBMISSION') {
        return res.status(400).json({
          error: 'Stage manager assignment can only be started if the festival is in the SUBMISSION state.'
        });
      }
  
      // Transition the festival state to ASSIGNMENT
      festival.state = 'ASSIGNMENT';
  
      // Save the updated festival
      await festival.save();
  
      res.status(200).json({
        message: 'Stage manager assignment has started successfully.',
        festival: {
          id: festival._id,
          name: festival.name,
          state: festival.state
        }
      });
    } catch (error) {
      console.error('Error starting stage manager assignment:', error);
      res.status(500).json({ error: 'An error occurred while starting stage manager assignment.' });
    }
  });
  

// Route to start the review process for the festival
router.post('/start-review/:festivalId', Organizer, async (req, res) => {
    try {
      const { festivalId } = req.params;
  
      // Find the festival by ID
      const festival = await Festival.findById(festivalId);
      if (!festival) {
        return res.status(404).json({ error: 'Festival not found.' });
      }
  
      // Check if the festival is in the ASSIGNMENT state
      if (festival.state !== 'ASSIGNMENT') {
        return res.status(400).json({
          error: 'Review can only be started when the festival is in the ASSIGNMENT state.'
        });
      }
  
      // Update the state of the festival to REVIEW
      festival.state = 'REVIEW';
  
      // Save the updated festival
      await festival.save();
  
      // Respond with success message
      res.status(200).json({
        message: 'Review process has been successfully started for the festival.',
        festival: {
          id: festival._id,
          name: festival.name,
          state: festival.state
        }
      });
    } catch (error) {
      console.error('Error starting review process:', error);
      res.status(500).json({ error: 'An error occurred while starting the review process.' });
    }
  });


// Route to transition the festival state to SCHEDULING
router.post('/schedule/:festivalId', Organizer, async (req, res) => {
  try {
    const { festivalId } = req.params;

    // Validate festivalId
    if (!festivalId) {
      return res.status(400).json({ error: 'Festival ID is required.' });
    }

    // Find the festival by its ID
    const festival = await Festival.findById(festivalId);

    if (!festival) {
      return res.status(404).json({ error: 'Festival not found.' });
    }

    // Check if the current state is REVIEW
    if (festival.state !== 'REVIEW') {
      return res.status(400).json({
        error: 'Scheduling is not allowed. The festival must be in the REVIEW state.',
      });
    }

    // Transition the state to SCHEDULING
    festival.state = 'SCHEDULING';
    await festival.save();

    res.status(200).json({
      message: 'Schedule making started successfully. The festival state is now SCHEDULING.',
      festival: {
        id: festival._id,
        name: festival.name,
        state: festival.state,
      },
    });
  } catch (error) {
    console.error('Error starting schedule making:', error);
    res.status(500).json({ error: 'An error occurred while starting schedule making.' });
  }
});

// Route to start the final submission process
router.post('/final-submission/:festivalId', Organizer, async (req, res) => {
  try {
    const { festivalId } = req.params;

    // Validate input
    if (!festivalId) {
      return res.status(400).json({ error: 'Festival ID is required.' });
    }

    // Find the festival by its ID
    const festival = await Festival.findById(festivalId);

    if (!festival) {
      return res.status(404).json({ error: 'Festival not found.' });
    }

    // Check if the festival is in the SCHEDULING state
    if (festival.state !== 'SCHEDULING') {
      return res.status(400).json({
        error: 'Final submission is not allowed. The festival must be in the SCHEDULING state.',
      });
    }

    // Update the festival state to FINAL_SUBMISSION
    festival.state = 'FINAL_SUBMISSION';
    await festival.save();

    res.status(200).json({
      message: 'Final submission process started successfully.',
      festival: {
        id: festival._id,
        name: festival.name,
        state: festival.state,
      },
    });
  } catch (error) {
    console.error('Error starting final submission:', error);
    res.status(500).json({ error: 'An error occurred while starting the final submission process.' });
  }
});
// Route for decision making
router.post('/decision-making/:festivalId',  Organizer,async (req, res) => {
  try {
    const { festivalId } = req.params;

    // Find the festival by its ID
    const festival = await Festival.findById(festivalId);
    if (!festival) {
      return res.status(404).json({ error: 'Festival not found.' });
    }

    // Check if the festival is in the FINAL_SUBMISSION state
    if (festival.state !== 'FINAL_SUBMISSION') {
      return res.status(400).json({
        error: 'Decision making is not allowed. The festival must be in the FINAL_SUBMISSION state.',
      });
    }

    // Find performances in SCHEDULED state related to this festival
    const performances = await Performance.find({ festivalId: festivalId, state: 'SCHEDULED' });

    if (!performances || performances.length === 0) {
      return res.status(404).json({ error: 'No performances found in SCHEDULED state.' });
    }

    // Example decision logic: Update each performance state (e.g., accept it)
    const decisions = [];
    for (const performance of performances) {
      const updatedPerformance = await Performance.findByIdAndUpdate(performance._id, {
        state: 'ACCEPTED', // Or any other action you want to perform
      }, { new: true });

      decisions.push(updatedPerformance);
    }

    // After decision-making, change the festival state to 'DECISION'
    const updatedFestival = await Festival.findByIdAndUpdate(festivalId, {
      state: 'DECISION', // Change the festival state to 'DECISION'
    }, { new: true });

    res.status(200).json({
      message: 'Decision making completed successfully.',
      decisions: decisions,
      festival: updatedFestival, // Include the updated festival details in the response
    });
  } catch (error) {
    console.error('Error during decision making:', error);
    res.status(500).json({ error: 'An error occurred while making decisions for the festival.' });
  }
});
router.post('/announce/:festivalId', Organizer, async (req, res) => {
  try {
    const { festivalId } = req.params;

    // Validate input
    if (!festivalId) {
      return res.status(400).json({ error: 'Festival ID is required.' });
    }

    // Find the festival by its ID
    const festival = await Festival.findById(festivalId);

    if (!festival) {
      return res.status(404).json({ error: 'Festival not found.' });
    }

    // Check if the festival is in the DECISION state
    if (festival.state !== 'DECISION') {
      return res.status(400).json({
        error: 'Announcement is not allowed. The festival must be in the DECISION state.',
      });
    }

    // Validate that optional fields are completed
    const missingFields = [];

    // Check venueLayout
    if (
      !festival.venueLayout ||
      !festival.venueLayout.stages.length ||
      !festival.venueLayout.vendorAreas.length
    ) {
      missingFields.push('venueLayout (stages and vendor areas)');
    }

    // Check budget
    if (
      !festival.budget ||
      festival.budget.tracking <= 0 ||
      festival.budget.costs <= 0 ||
      festival.budget.logistics <= 0 ||
      festival.budget.expectedRevenue <= 0
    ) {
      missingFields.push('budget (tracking, costs, logistics, and expected revenue)');
    }

    // Check vendorManagement
    if (
      !festival.vendorManagement ||
      !festival.vendorManagement.foodStalls.length ||
      !festival.vendorManagement.merchandiseBooths.length
    ) {
      missingFields.push('vendorManagement (food stalls and merchandise booths)');
    }

    // If any fields are missing, send an error response
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Announcement cannot proceed. The following fields are missing or incomplete:',
        missingFields,
      });
    }

    // Update the festival state to ANNOUNCED
    festival.state = 'ANNOUNCED';
    await festival.save();

    res.status(200).json({
      message: 'Festival announced successfully.',
      festival: {
        id: festival._id,
        name: festival.name,
        state: festival.state,
      },
    });
  } catch (error) {
    console.error('Error announcing festival:', error);
    res.status(500).json({ error: 'An error occurred while announcing the festival.' });
  }
});

// Festival search route for visitors
router.get('/search', async (req, res) => {
  const { name, description, startDate, endDate, venue } = req.query;  // Search filters

  try {
    // Build the base query to filter only festivals in 'ANNOUNCED' state
    const query = { state: 'ANNOUNCED' };

    // Apply search filters to the query if provided
    if (name) {
      query.name = { $regex: new RegExp(name.split(' ').join('.*'), 'i') }; // Match all words in name
    }

    if (description) {
      query.description = { $regex: new RegExp(description.split(' ').join('.*'), 'i') }; // Match all words in description
    }

    if (startDate || endDate) {
      query.startDate = {};  // Initialize a date query object

      if (startDate) {
        query.startDate.$gte = new Date(startDate); // Festivals starting on or after the provided startDate
      }

      if (endDate) {
        query.startDate.$lte = new Date(endDate); // Festivals starting on or before the provided endDate
      }
    }

    if (venue) {
      query.venue = { $regex: new RegExp(venue.split(' ').join('.*'), 'i') }; // Match all words in venue
    }

    // Find the festivals that match the query
    const festivals = await Festival.find(query)
      .sort({ startDate: 1, name: 1 }) // Sort first by start date, then by name
      .exec();

    if (festivals.length === 0) {
      return res.status(404).json({ error: 'No festivals found for your criteria.' });
    }

    // Extract relevant information from each festival
    const festivalDetails = festivals.map(festival => ({
      id: festival._id,
      name: festival.name,
      description: festival.description,
      startDate: festival.startDate,
      endDate: festival.endDate,
      venue: festival.venue,
      state: festival.state,
    }));

    res.status(200).json({
      message: 'Festivals retrieved successfully.',
      festivals: festivalDetails,
    });

  } catch (error) {
    console.error('Error searching festivals:', error);
    res.status(500).json({ error: 'An error occurred while searching for festivals.' });
  }
});

// Route to view all festivals in the ANNOUNCED state
router.get('/view', async (req, res) => {
  try {
    // Find all festivals in the ANNOUNCED state
    const festivals = await Festival.find({ state: 'ANNOUNCED' }).sort({ startDate: 1, name: 1 });

    if (festivals.length === 0) {
      return res.status(404).json({ error: 'No announced festivals found.' });
    }

    // Return the details of all the festivals in the ANNOUNCED state
    res.status(200).json({
      message: 'Announced festivals retrieved successfully.',
      festivals: festivals.map(festival => ({
        id: festival._id,
        name: festival.name,
        description: festival.description,
        startDate: festival.startDate,
        endDate: festival.endDate,
        venue: festival.venue,
        state: festival.state,
      })),
    });
  } catch (error) {
    console.error('Error retrieving announced festivals:', error);
    res.status(500).json({ error: 'An error occurred while retrieving the announced festivals.' });
  }
});

// Route for viewing festivals and performances for the organizer
router.get('/view-responsible-festivals', Organizer, async (req, res) => {
  try {
    const { userId } = req.user; // Assuming the organizer's ID is available in `req.user`

    // Find all festivals where the organizer is responsible
    const festivals = await Festival.find({ organizer: userId }).sort({ startDate: 1, name: 1 });

    if (festivals.length === 0) {
      return res.status(404).json({ error: 'No festivals found for which you are responsible.' });
    }

    // Retrieve performances for each festival
    const festivalsWithPerformances = await Promise.all(festivals.map(async (festival) => {
      // Find performances related to this festival
      const performances = await Performance.find({ festival: festival._id }).populate('artists', 'name') // Populating artist names for clarity
        .sort({ genre: 1, name: 1 }); // Sort by genre and name

      // Return festival details along with performances
      return {
        id: festival._id,
        name: festival.name,
        description: festival.description,
        startDate: festival.startDate,
        endDate: festival.endDate,
        venue: festival.venue,
        state: festival.state,
        performances: performances.map(performance => ({
          id: performance._id,
          name: performance.name,
          artists: performance.artists.map(artist => artist.name), // Populate artist names
          genre: performance.genre,
          setlist: performance.setlist,
          state: performance.state,
          scheduledTime: performance.scheduledTime, // Scheduled time for the performance
          stage: performance.stage, // The stage or location within the festival
        })),
        
      };
    }));

    res.status(200).json({
      message: 'Festivals and performances retrieved successfully.',
      festivals: festivalsWithPerformances,
    });
  } catch (error) {
    console.error('Error retrieving festivals and performances for organizer:', error);
    res.status(500).json({ error: 'An error occurred while retrieving festivals and performances.' });
  }
});


module.exports = router;
