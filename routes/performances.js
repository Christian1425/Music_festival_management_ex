const express = require('express');
const router = express.Router();
const Performance = require('../models/Performance'); 
const Festival = require('../models/Festival'); 
const User = require('../models/User'); 
const {Staff} = require('../middleware/Staff'); 
const {Organizer} = require('../middleware/Organizer'); 
const {Artist} = require('../middleware/Artist'); 

router.get('/', (req, res) => {
  res.status(200).json({ message: 'Performances retrieved successfully' });
});

// Route for creating a new performance
router.post('/', Artist, async (req, res) => {
  try {
    const {
      festivalId,
      name,
      description,
      genre,
      duration,
      bandMembers,
      artists, // List of artist IDs (Users with the "ARTIST" role)
      technicalRequirements,
      setlist,
      merchandiseItems,
      preferredRehearsalTimes,
      preferredPerformanceSlots,
    } = req.body;

    // Check if all required fields are provided
    if (!name || !description || !genre || !duration || !bandMembers || !artists) {
      return res.status(400).json({ message: 'Name, description, genre, duration, band members, and artists are required.' });
    }

    // Find the festival by its ID
    const festival = await Festival.findById(festivalId);
    if (!festival) {
      return res.status(400).json({ message: 'Festival not found.' });
    }

    // Check if the performance name is unique within the festival
    const existingPerformance = await Performance.findOne({ festivalId, name });
    if (existingPerformance) {
      return res.status(400).json({ message: 'Performance name must be unique within the festival.' });
    }

    // Validate that all band members are users with the "ARTIST" role
    const invalidBandMembers = [];
    for (const bandMemberId of bandMembers) {
      const user = await User.findById(bandMemberId);
      if (!user || !user.role || !user.role.includes('ARTIST')) {
        invalidBandMembers.push(bandMemberId);
      }
    }

    if (invalidBandMembers.length > 0) {
      return res.status(400).json({ 
        message: `The following band members are invalid or do not have the "ARTIST" role: ${invalidBandMembers.join(', ')}` 
      });
    }

    // Validate that all artists are users with the "ARTIST" role
    const invalidArtists = [];
    for (const artistId of artists) {
      const user = await User.findById(artistId);
      if (!user || !user.role || !user.role.includes('ARTIST')) {
        invalidArtists.push(artistId);
      }
    }

    if (invalidArtists.length > 0) {
      return res.status(400).json({ 
        message: `The following artists are invalid or do not have the "ARTIST" role: ${invalidArtists.join(', ')}` 
      });
    }

    // Create a new performance with all the provided data
    const performance = new Performance({
      name,
      description,
      genre,
      duration,
      bandMembers,
      artists,
      technicalRequirements,
      setlist,
      merchandiseItems,
      preferredRehearsalTimes,
      preferredPerformanceSlots,
      festivalId, // Reference to the specific festival
      state: 'CREATED', // Default state
    });

    // Save the performance to the database
    const savedPerformance = await performance.save();

    // After the performance is saved, add the performance ID to the festival's performance array
    festival.performances.push(savedPerformance._id);

    // Save the updated festival document
    await festival.save();

    // Return the saved performance in the response
    res.status(201).json(savedPerformance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Route for updating a performance
router.put('/:performanceId',Artist, async (req, res) => {
    try {
      const performanceId = req.params.performanceId; // Get performance ID from route parameters
      const {
        name,
        description,
        genre,
        duration,
        bandMembers,
        artists,
        technicalRequirements,
        setlist,
        merchandiseItems,
        preferredRehearsalTimes,
        preferredPerformanceSlots,
      } = req.body;
  
      // Find the performance by its ID
      const performance = await Performance.findById(performanceId);
      if (!performance) {
        return res.status(404).json({ message: 'Performance not found.' });
      }
  
      // Check if the performance is in an editable state (e.g., CREATED or SUBMITTED)
      if (performance.state === 'REVIEWED' || performance.state === 'APPROVED' || performance.state === 'SCHEDULED') {
        return res.status(400).json({ message: 'Performance cannot be updated in its current state.' });
      }
  
      // Optionally, validate that band members and artists are users with the "ARTIST" role
      if (bandMembers) {
        const invalidBandMembers = [];
        for (const bandMemberId of bandMembers) {
          const user = await User.findById(bandMemberId);
          if (!user || !user.role || !user.role.includes('ARTIST')) {
            invalidBandMembers.push(bandMemberId);
          }
        }
        if (invalidBandMembers.length > 0) {
          return res.status(400).json({
            message: `The following band members are invalid or do not have the "ARTIST" role: ${invalidBandMembers.join(', ')}`,
          });
        }
      }
  
      if (artists) {
        const invalidArtists = [];
        for (const artistId of artists) {
          const user = await User.findById(artistId);
          if (!user || !user.role || !user.role.includes('ARTIST')) {
            invalidArtists.push(artistId);
          }
        }
        if (invalidArtists.length > 0) {
          return res.status(400).json({
            message: `The following artists are invalid or do not have the "ARTIST" role: ${invalidArtists.join(', ')}`,
          });
        }
      }
  
      // Update the performance with the new data
      if (name) performance.name = name;
      if (description) performance.description = description;
      if (genre) performance.genre = genre;
      if (duration) performance.duration = duration;
      if (bandMembers) performance.bandMembers = bandMembers;
      if (artists) performance.artists = artists;
      if (technicalRequirements) performance.technicalRequirements = technicalRequirements;
      if (setlist) performance.setlist = setlist;
      if (merchandiseItems) performance.merchandiseItems = merchandiseItems;
      if (preferredRehearsalTimes) performance.preferredRehearsalTimes = preferredRehearsalTimes;
      if (preferredPerformanceSlots) performance.preferredPerformanceSlots = preferredPerformanceSlots;
  
      // Save the updated performance
      const updatedPerformance = await performance.save();
  
      // Return the updated performance in the response
      res.status(200).json(updatedPerformance);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });



// Route to add a band member to a performance
router.put('/:festivalId/:performanceId/add-band-member',Artist, async (req, res) => {
    try {
      const festivalId = req.params.festivalId; // Get festival ID from route parameters
      const performanceId = req.params.performanceId; // Get performance ID from route parameters
      const { userId } = req.body; // User ID to be added as a band member
  
      // Validate the user ID
      if (!userId) {
        return res.status(400).json({ error: 'User ID must be provided.' });
      }
  
      // Find the festival by its ID
      const festival = await Festival.findById(festivalId);
      if (!festival) {
        return res.status(404).json({ error: 'Festival not found.' });
      }
  
      // Find the performance by its ID
      const performance = await Performance.findById(performanceId);
      if (!performance) {
        return res.status(404).json({ error: 'Performance not found.' });
      }
  
      // Check if the user exists in the database
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }
  
      // Ensure the user is not already a band member for this performance
      if (performance.bandMembers.includes(userId)) {
        return res.status(400).json({ error: 'User is already a band member for this performance.' });
      }
  
      // Add the user to the band members of the performance
      performance.bandMembers.push(userId);
  
      // Update the user's role to include "ARTIST" for this festival
      if (!user.role.includes('ARTIST')) {
        user.role.push('ARTIST');
      }
  
      // Save the updated performance and user
      await performance.save();
      await user.save();
  
      // Respond with the updated performance and user
      res.status(200).json({
        message: 'User added as band member and role updated to ARTIST.',
        updatedPerformance: performance,
        updatedUser: user
      });
      
    } catch (error) {
      console.error('Error adding band member:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
// Route to submit a performance to a festival
router.post('/submit/:performanceId',Artist, async (req, res) => {
  try {
    const { performanceId } = req.params;

    // Find the performance by ID
    const performance = await Performance.findById(performanceId);
    if (!performance) {
      return res.status(404).json({ error: 'Performance not found.' });
    }

    // Find the associated festival
    const festival = await Festival.findById(performance.festivalId);
    if (!festival) {
      return res.status(404).json({ error: 'Associated festival not found.' });
    }

    // Check if the festival is in the SUBMISSION state
    if (festival.state !== 'SUBMISSION') {
      return res.status(400).json({ error: 'Submissions are not allowed. The festival is not in the SUBMISSION state.' });
    }

    // Validate that all required performance fields are present
    const requiredFields = [
      'name',
      'description',
      'genre',
      'duration',
      'bandMembers'
    ];
    const optionalFields = [
      'technicalRequirements',
      'setlist',
      'merchandiseItems',
      'preferredRehearsalTimes',
      'preferredPerformanceSlots'
    ];

    const missingRequiredFields = requiredFields.filter((field) => !performance[field] || performance[field].length === 0);
    const missingOptionalFields = optionalFields.filter((field) => !performance[field] || performance[field].length === 0);

    if (missingRequiredFields.length > 0) {
      return res.status(400).json({
        error: `Performance submission failed. The following required fields are missing: ${missingRequiredFields.join(', ')}`
      });
    }

    if (missingOptionalFields.length > 0) {
      return res.status(400).json({
        error: `Performance submission failed. The following optional fields must be completed before submission: ${missingOptionalFields.join(', ')}`
      });
    }

    // Update the performance state to 'SUBMITTED'
    performance.state = 'SUBMITTED';

    // Save the updated performance
    await performance.save();

    res.status(200).json({
      message: 'Performance submitted successfully.',
      performance: {
        id: performance._id,
        name: performance.name,
        description: performance.description,
        genre: performance.genre,
        duration: performance.duration,
        bandMembers: performance.bandMembers,
        state: performance.state,
        festivalId: performance.festivalId,
        technicalRequirements: performance.technicalRequirements,
        setlist: performance.setlist,
        merchandiseItems: performance.merchandiseItems,
        preferredRehearsalTimes: performance.preferredRehearsalTimes,
        preferredPerformanceSlots: performance.preferredPerformanceSlots
      }
    });
  } catch (error) {
    console.error('Error submitting performance:', error);
    res.status(500).json({ error: 'An error occurred while submitting the performance.' });
  }
});

  
  
// Route to withdraw a performance
router.delete('/withdraw/:performanceId',Artist, async (req, res) => {
    try {
      const { performanceId } = req.params;
  
      // Find the performance by ID
      const performance = await Performance.findById(performanceId);
      if (!performance) {
        return res.status(404).json({ error: 'Performance not found.' });
      }
  
      // Check if the performance is in a state that allows withdrawal
      if (performance.state === 'SUBMITTED') {
        return res.status(400).json({
          error: 'Performance cannot be withdrawn. It has already been SUBMITTED and entered the formal review process.'
        });
      }
  
      // Delete the performance from the system
      await Performance.findByIdAndDelete(performanceId);
  
      res.status(200).json({
        message: 'Performance withdrawn successfully and deleted from the system.',
        performanceId: performanceId
      });
    } catch (error) {
      console.error('Error withdrawing performance:', error);
      res.status(500).json({ error: 'An error occurred while withdrawing the performance.' });
    }
  });

// Route to assign a staff member as the stage manager for a performance
router.post('/assign-stage-manager/:festivalId/:performanceId', Organizer,async (req, res) => {
    try {
      const { festivalId, performanceId } = req.params;
      const { staffId } = req.body;
  
      // Validate that staffId is provided
      if (!staffId) {
        return res.status(400).json({ error: 'Staff ID is required to assign as stage manager.' });
      }
  
      // Find the festival by ID
      const festival = await Festival.findById(festivalId);
      if (!festival) {
        return res.status(404).json({ error: 'Festival not found.' });
      }
  
      // Check if the festival is in the ASSIGNMENT state
      if (festival.state !== 'ASSIGNMENT') {
        return res.status(400).json({
          error: 'Staff assignment can only be done when the festival is in the ASSIGNMENT state.'
        });
      }
  
      // Find the performance by ID
      const performance = await Performance.findById(performanceId);
      if (!performance) {
        return res.status(404).json({ error: 'Performance not found.' });
      }
  
      // Ensure the staff member exists and has the "STAFF" role for this festival
      const staffMember = await User.findById(staffId);
      if (!staffMember || !staffMember.role || !staffMember.role.includes('STAFF')) {
        return res.status(400).json({
          error: 'The provided user must be a registered staff member for the festival.'
        });
      }
  
      // Ensure that only one staff member can be assigned to a performance as stage manager
      if (performance.stageManager) {
        return res.status(400).json({ error: 'This performance already has a stage manager assigned.' });
      }
  
      // Assign the staff member as the stage manager for the performance
      performance.stageManager = staffId;
  
      // Save the updated performance
      await performance.save();
  
      // Respond with success message
      res.status(200).json({
        message: 'Staff member successfully assigned as the stage manager for the performance.',
        performance: {
          id: performance._id,
          name: performance.name,
          stageManager: performance.stageManager
        }
      });
    } catch (error) {
      console.error('Error assigning staff as stage manager:', error);
      res.status(500).json({ error: 'An error occurred while assigning the staff member.' });
    }
  });
  router.post('/review/:performanceId', Staff, async (req, res) => {
    try {
      const { performanceId } = req.params;
      const { score, comments } = req.body;
      const userId = req.user._id;
  
      // Validate input
      if (typeof score !== 'number' || score < 1 || score > 10) {
        return res.status(400).json({ error: 'Score must be a number between 1 and 10.' });
      }
      if (!comments || comments.trim().length === 0) {
        return res.status(400).json({ error: 'Comments are required.' });
      }
  
      // Find the performance by ID
      const performance = await Performance.findById(performanceId);
      if (!performance) {
        return res.status(404).json({ error: 'Performance not found.' });
      }
  
      // Find the associated festival
      const festival = await Festival.findById(performance.festivalId);
      if (!festival) {
        return res.status(404).json({ error: 'Festival not found.' });
      }
  
      // Ensure the festival is in the REVIEW state
      if (festival.state !== 'REVIEW') {
        return res.status(400).json({
          error: 'Performance review is not allowed. The festival is not in the REVIEW state.',
        });
      }
  
      // Ensure the logged-in user is the assigned stage manager
      if (performance.stageManager.toString() !== userId.toString()) {
        return res.status(403).json({
          error: 'You are not authorized to review this performance. Only the assigned stage manager can review.',
        });
      }
  
      // Update the performance fields
      performance.score = score;
      performance.reviewerComments = comments;
      performance.state = 'REVIEWED';
  
      // Save the updated performance
      await performance.save();
  
      // Debugging output
      console.log('Updated performance:', performance);
  
      // Respond with the updated performance
      res.status(200).json({
        message: 'Performance review submitted successfully.',
        performance: {
          id: performance._id,
          name: performance.name,
          score: performance.score,
          reviewerComments: performance.reviewerComments,
          state: performance.state,
          festivalId: performance.festivalId,
          stageManager: performance.stageManager,
        },
      });
    } catch (error) {
      console.error('Error submitting performance review:', error);
      res.status(500).json({ error: 'An error occurred while submitting the performance review.' });
    }
  });
  
// Route to approve a performance
router.post('/approve/:festivalId/:performanceId',  Organizer,async (req, res) => {
  try {
    const { festivalId, performanceId } = req.params;

    // Validate festivalId and performanceId
    if (!festivalId || !performanceId) {
      return res.status(400).json({ error: 'Festival ID and Performance ID are required.' });
    }

    // Find the festival by its ID
    const festival = await Festival.findById(festivalId);

    if (!festival) {
      return res.status(404).json({ error: 'Festival not found.' });
    }

    // Check if the festival is in the SCHEDULING state
    if (festival.state !== 'SCHEDULING') {
      return res.status(400).json({
        error: 'Approval is not allowed. The festival must be in the SCHEDULING state.',
      });
    }

    // Find the performance by its ID
    const performance = await Performance.findById(performanceId);

    if (!performance) {
      return res.status(404).json({ error: 'Performance not found.' });
    }

    // Check if the performance is already approved
    if (performance.state === 'APPROVED') {
      return res.status(400).json({ error: 'Performance is already approved.' });
    }

    // Approve the performance
    performance.state = 'APPROVED';
    await performance.save();

    res.status(200).json({
      message: 'Performance approved successfully.',
      performance: {
        id: performance._id,
        name: performance.name,
        state: performance.state,
      },
    });
  } catch (error) {
    console.error('Error approving performance:', error);
    res.status(500).json({ error: 'An error occurred while approving the performance.' });
  }
});

// Route to reject a performance manually
router.post('/reject/:festivalId/:performanceId', Organizer, async (req, res) => {
  try {
    const { festivalId, performanceId } = req.params;
    const { rejectionReason } = req.body;

    // Validate input
    if (!festivalId || !performanceId) {
      return res.status(400).json({ error: 'Festival ID and Performance ID are required.' });
    }

    if (!rejectionReason || rejectionReason.trim() === '') {
      return res.status(400).json({ error: 'Rejection reason is required.' });
    }

    // Find the festival by its ID
    const festival = await Festival.findById(festivalId);

    if (!festival) {
      return res.status(404).json({ error: 'Festival not found.' });
    }

    // Check if the festival is in the SCHEDULING state
    if (festival.state !== 'SCHEDULING') {
      return res.status(400).json({
        error: 'Rejection is not allowed. The festival must be in the SCHEDULING state.',
      });
    }

    // Find the performance by its ID
    const performance = await Performance.findById(performanceId);

    if (!performance) {
      return res.status(404).json({ error: 'Performance not found.' });
    }

    // Ensure the logged-in user is an organizer
    if (!req.user.roles.includes('ORGANIZER')) {
      return res.status(403).json({ error: 'Only ORGANIZERS are allowed to reject performances.' });
    }

    // Check if the performance is already rejected
    if (performance.state === 'REJECTED') {
      return res.status(400).json({ error: 'Performance is already rejected.' });
    }

    // Reject the performance and add the rejection reason
    performance.state = 'REJECTED';
    performance.rejectionReason = rejectionReason;
    await performance.save();

    res.status(200).json({
      message: 'Performance rejected successfully.',
      performance: {
        id: performance._id,
        name: performance.name,
        state: performance.state,
        rejectionReason: performance.rejectionReason,
      },
    });
  } catch (error) {
    console.error('Error rejecting performance:', error);
    res.status(500).json({ error: 'An error occurred while rejecting the performance.' });
  }
});
// Route for performance final submission
router.post('/final-submission/:festivalId/:performanceId',Artist, async (req, res) => {
  try {
    const { festivalId, performanceId } = req.params;
    const { setlist, timeSlot, rehearsalTime } = req.body;

    // Validate input
    if (!setlist || !timeSlot || !rehearsalTime) {
      return res.status(400).json({ error: 'Setlist, TimeSlot, and RehearsalTime are required.' });
    }

    // Find the festival by its ID
    const festival = await Festival.findById(festivalId);
    if (!festival) {
      return res.status(404).json({ error: 'Festival not found.' });
    }

    // Check if the festival is in the FINAL_SUBMISSION state
    if (festival.state !== 'FINAL_SUBMISSION') {
      return res.status(400).json({
        error: 'Final submission is not allowed. The festival must be in the FINAL_SUBMISSION state.',
      });
    }

    // Find the performance by its ID
    const performance = await Performance.findById(performanceId);
    if (!performance) {
      return res.status(404).json({ error: 'Performance not found.' });
    }

    // Add the final details to the performance
    performance.setlist = setlist;
    performance.timeSlot = timeSlot;
    performance.rehearsalTime = rehearsalTime;
    performance.state = 'SCHEDULED'; // Mark the performance as final submitted

    // Save the updated performance
    await performance.save();

    res.status(200).json({
      message: 'Performance final details submitted successfully.',
      performance: {
        id: performance._id,
        name: performance.name,
        setlist: performance.setlist,
        timeSlot: performance.timeSlot,
        rehearsalTime: performance.rehearsalTime,
        state: performance.state
      }
    });
  } catch (error) {
    console.error('Error submitting final performance details:', error);
    res.status(500).json({ error: 'An error occurred while submitting the performance details.' });
  }
});

// Route for manual performance rejection by ORGANIZER
router.post('/manual-reject-performance/:festivalId/:performanceId', Organizer, async (req, res) => {
  try {
    const { festivalId, performanceId } = req.params;
    const { rejectionReason } = req.body; // Reason for rejection (manual rejection)

    // Validate input
    if (!rejectionReason) {
      return res.status(400).json({ error: 'Rejection reason is required for manual rejection.' });
    }

    // Find the festival by its ID
    const festival = await Festival.findById(festivalId);
    if (!festival) {
      return res.status(404).json({ error: 'Festival not found.' });
    }

    // Check if the festival is in the DECISION state
    if (festival.state !== 'DECISION') {
      return res.status(400).json({
        error: 'Rejection is not allowed. The festival must be in the DECISION state.',
      });
    }

    // Find the performance by its ID
    const performance = await Performance.findById(performanceId);
    if (!performance) {
      return res.status(404).json({ error: 'Performance not found.' });
    }



    // Reject the performance manually with the provided reason
    performance.state = 'REJECTED';
    performance.rejectionReason = rejectionReason; // Set the rejection reason provided by the organizer
    await performance.save();

    return res.status(200).json({
      message: 'Performance manually rejected successfully.',
      performance: {
        id: performance._id,
        name: performance.name,
        state: performance.state,
        rejectionReason: performance.rejectionReason,
      },
    });
  } catch (error) {
    console.error('Error during manual rejection:', error);
    res.status(500).json({ error: 'An error occurred during manual rejection.' });
  }
});

// Route to accept a performance and schedule it in the festival
router.post('/accept-performance/:festivalId/:performanceId', Organizer, async (req, res) => {
  try {
    const { festivalId, performanceId } = req.params;

    // Find the festival by ID
    const festival = await Festival.findById(festivalId);
    if (!festival) {
      return res.status(404).json({ error: 'Festival not found.' });
    }

    // Ensure the festival is in the DECISION state
    if (festival.state !== 'DECISION') {
      return res.status(400).json({
        error: 'Performance acceptance is only allowed when the festival is in the DECISION state.',
      });
    }

    // Find the performance by ID
    const performance = await Performance.findById(performanceId);
    if (!performance) {
      return res.status(404).json({ error: 'Performance not found.' });
    }

    // Update the performance state to "ACCEPTED" and add it to the festival
    performance.state = 'ACCEPTED';
    festival.performances.push(performance._id);

    // Save the updates
    await performance.save();
    await festival.save();

    res.status(200).json({
      message: 'Performance accepted and scheduled successfully.',
      performance: {
        id: performance._id,
        name: performance.name,
        state: performance.state,
      },
    });
  } catch (error) {
    console.error('Error accepting performance:', error);
    res.status(500).json({ error: 'An error occurred while accepting the performance.' });
  }
});
// Route for performance search (only SCHEDULED performances)
router.get('/search-performances', async (req, res) => {
  try {
    const { name, artists, genre } = req.query;

    // Base query: Only scheduled performances
    const query = { state: 'SCHEDULED' };

    // Add search criteria for name
    if (name) {
      const nameWords = name.split(' ').map((word) => ({
        name: { $regex: word, $options: 'i' }, // Case-insensitive match for each word
      }));
      query.$and = [...(query.$and || []), ...nameWords]; // Add word conditions to the query
    }

    // Add search criteria for artists
    if (artists) {
      const artistIds = artists.split(','); // Assume artists query is a comma-separated list of IDs
      query.artists = { $all: artistIds };
    }

    // Add search criteria for genre
    if (genre) {
      query.genre = new RegExp(genre, 'i'); // Case-insensitive genre search
    }

    // Find performances matching the query
    const performances = await Performance.find(query)
      .sort({ genre: 1, name: 1 }) // Sort by genre, then by name
      .select('name genre artists description state setlist'); // Limit fields in the response

    if (performances.length === 0) {
      return res.status(404).json({ error: 'No performances match the search criteria.' });
    }

    res.status(200).json({
      message: 'Performances found.',
      performances,
    });
  } catch (error) {
    console.error('Error during performance search:', error);
    res.status(500).json({ error: 'An error occurred while searching for performances.' });
  }
});

// Route for viewing all performances in the SCHEDULED state
router.get('/view-scheduled-performances', async (req, res) => {
  try {
    // Find all performances in the SCHEDULED state
    const performances = await Performance.find({ state: 'SCHEDULED' })
      .sort({ genre: 1, name: 1 }) // Sort by genre, then by name
      .select('name genre artists description state setlist'); // Select only relevant fields

    if (performances.length === 0) {
      return res.status(404).json({ error: 'No performances are currently scheduled.' });
    }

    res.status(200).json({
      message: 'Scheduled performances retrieved successfully.',
      performances,
    });
  } catch (error) {
    console.error('Error retrieving scheduled performances:', error);
    res.status(500).json({ error: 'An error occurred while retrieving scheduled performances.' });
  }
});
// Route for viewing all performances of the artist or as a band member
router.get('/view-all-performances', Artist, async (req, res) => {
  try {
    // Find performances where the user is listed as an artist or a band member
    const performances = await Performance.find({
      $or: [
        { artists: req.user._id }, // User is listed in 'artists'
        { bandMembers: req.user._id } // User is listed in 'bandMembers'
      ]
    })
      .populate('artists', 'username') // Populate artist usernames
      .populate('bandMembers', 'username'); // Populate band member usernames

    if (performances.length === 0) {
      return res.status(404).json({ message: 'No performances found.' });
    }

    // Extract relevant information from each performance
    const performanceDetails = performances.map(performance => ({
      id: performance._id,
      name: performance.name,
      genre: performance.genre,
      state: performance.state,
      setlist: performance.setlist,
      timeSlot: performance.timeSlot,
      rehearsalTime: performance.rehearsalTime,
      artists: performance.artists.map(artist => artist.username), // List of artist usernames
      bandMembers: performance.bandMembers.map(member => member.username), // List of band member usernames
    }));

    res.status(200).json({
      message: 'Performances retrieved successfully.',
      performances: performanceDetails,
    });
  } catch (error) {
    console.error('Error fetching performances for artist:', error);
    res.status(500).json({ message: 'An error occurred while retrieving performances.' });
  }
});

// Route for staff to view all performances they are assigned to manage
router.get('/view-managed-performances', Staff, async (req, res) => {
  try {
    const { userId } = req.user; // Assuming the staff member's ID is available in `req.user`

    // Find performances where the staff member is assigned as the stage manager
    const performances = await Performance.find({
      stageManager: userId, // The staff member is listed as the 'stageManager'
    })
      .populate('artists', 'username') // Populate artist usernames
      .populate('bandMembers', 'username') // Populate band member usernames
      .populate('stageManager', 'username'); // Populate stage manager usernames

    if (performances.length === 0) {
      return res.status(404).json({ error: 'No performances found that you manage.' });
    }

    // Extract relevant information from each performance
    const performanceDetails = performances.map(performance => ({
      id: performance._id,
      name: performance.name,
      genre: performance.genre,
      state: performance.state,
      setlist: performance.setlist,
      timeSlot: performance.timeSlot,
      rehearsalTime: performance.rehearsalTime,
      artists: performance.artists ? performance.artists.map(artist => artist.username) : [], // Check if artists exists before mapping
      bandMembers: performance.bandMembers ? performance.bandMembers.map(member => member.username) : [], // Check if bandMembers exists
      stageManager: performance.stageManager ? performance.stageManager.username : '', // Check if stageManager exists
    }));

    res.status(200).json({
      message: 'Performances you manage retrieved successfully.',
      performances: performanceDetails,
    });
  } catch (error) {
    console.error('Error retrieving managed performances:', error);
    res.status(500).json({ error: 'An error occurred while retrieving performances.' });
  }
});



module.exports = router;
