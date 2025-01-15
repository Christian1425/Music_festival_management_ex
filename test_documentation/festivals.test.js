const request = require('supertest');
const app = require('../app'); // Your application instance
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Festival = require('../models/Festival');
const User = require('../models/User');
const bcrypt = require('bcrypt'); // Import bcrypt

// Setting a test secret key for JWT
process.env.JWT_KEY = 'testsecret';

jest.setTimeout(60000); // Extend timeout for DB operations

describe('Festival API Tests', () => {
  let server;
  let organizerToken;
  let organizerId;

  beforeAll(async () => {
    // Ensure MongoDB is connected
    if (!mongoose.connection.readyState) {
      await mongoose.connect('mongodb://127.0.0.1:27017/festival', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    }

    // Initialize server before running tests
    server = app.listen(5000, () => {
      console.log('Server is running on port 5000');
    });

    // Create an organizer user for testing with hashed password
    const hashedPassword = await bcrypt.hash('password123', 10);

    const organizer = await User.create({
      username: `organizer-${Date.now()}`,
      password: hashedPassword,
      fullName: 'Test Organizer',
      role: ['ORGANIZER'],
    });

    organizerId = organizer._id;

    // Generate a valid JWT token for the organizer
    organizerToken = jwt.sign(
      { id: organizer._id, roles: ['ORGANIZER'] },
      process.env.JWT_KEY,
      { expiresIn: '1h' }
    );

    console.log('Generated Organizer Token:', organizerToken); // Debugging token
  });

  afterAll(async () => {
    await mongoose.connection.close();

    // Ensure the server is closed properly after tests
    if (server) {
      server.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test
  });

  describe('POST /festivals/create', () => {
    it('should create a festival successfully', async () => {
      const festivalData = {
        name: `New Festival-${Date.now()}`,
        description: 'A great festival',
        dates: ['2025-06-01', '2025-06-05'],
        venue: 'Central Park',
        organizers: [organizerId],
        staff: [],
        performances: [],
        venueLayout: {
          stages: ['Main Stage', 'Side Stage'],
          vendorAreas: ['Food Court', 'Merchandise Area'],
        },
        budget: {
          tracking: 50000,
          costs: 20000,
          logistics: 10000,
          expectedRevenue: 70000,
        },
        vendorManagement: {
          foodStalls: ['Pizza Place', 'Burger Shack'],
          merchandiseBooths: ['T-Shirt Store', 'Hat Stand'],
        },
        state: 'CREATED',
      };

      const response = await request(server)
        .post('/festivals/create')
        .set('Authorization', `Bearer ${organizerToken}`)
        .send(festivalData);

      console.log('Response:', response.body); // Debug response
      console.log('Created Festival Details:', response.body); // Log created festival
      console.log('Festival Created By:', {
        organizerId,
        username: `organizer-${Date.now()}`,
        fullName: 'Test Organizer',
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('name', festivalData.name);
      expect(response.body).toHaveProperty('organizers');
      expect(response.body.organizers).toContain(String(organizerId));
      expect(response.body).toHaveProperty('budget');
      expect(response.body.budget).toMatchObject(festivalData.budget);
      expect(response.body).toHaveProperty('venueLayout');
      expect(response.body.venueLayout).toMatchObject(festivalData.venueLayout);
    });
  });

  describe('GET /festivals/view', () => {
    it('should log only announced festivals to the terminal output', async () => {
      // Fetch announced festivals directly from the database
      const announcedFestivals = await Festival.find({ state: 'ANNOUNCED' });

      const response = await request(server).get('/festivals/view');

      // Log announced festivals to the terminal
      console.log('Announced Festivals:', response.body.festivals);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Announced festivals retrieved successfully.');
      expect(response.body).toHaveProperty('festivals');

      // Ensure the response matches the announced festivals in the database
      const festivalNamesInResponse = response.body.festivals.map(festival => festival.name);
      const festivalNamesInDB = announcedFestivals.map(festival => festival.name);

      expect(festivalNamesInResponse).toEqual(expect.arrayContaining(festivalNamesInDB));
    });
  });

  describe('GET /festivals/search', () => {
    it('should return filtered festivals based on query parameters', async () => {
      const response = await request(server)
        .get('/festivals/search')
        .query({ name: 'Spring Music Fest 2025', description: 'An annual celebration of live music featuring bands, solo artists, and performances across multiple genres.' });

      console.log('Search Results:', response.body.festivals);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Festivals retrieved successfully.');
      expect(response.body).toHaveProperty('festivals');

      const returnedFestivals = response.body.festivals;
      returnedFestivals.forEach(festival => {
        expect(festival.state).toBe('ANNOUNCED');
      });
    });

    it('should return a 404 error if no festivals match the search criteria', async () => {
      const response = await request(server)
        .get('/festivals/search')
        .query({ name: 'NonExistentFestival' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'No festivals found for your criteria.');
    });
  });
});