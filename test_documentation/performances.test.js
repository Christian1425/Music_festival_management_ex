const request = require('supertest');
const app = require('../app'); // Your application instance
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Performance = require('../models/Performance');
const Festival = require('../models/Festival');
const User = require('../models/User');
const bcrypt = require('bcrypt'); // Import bcrypt
const Artist = require('../middleware/Artist'); // Middleware for artist authentication
// Setting a test secret key for JWT
process.env.JWT_KEY = 'testsecret';

jest.setTimeout(60000); // Extend timeout for DB operations

describe('Performance API Tests', () => {
  let server;
  let artistToken;
  let artistId;
  let festivalId;

  beforeAll(async () => {
    // Start the server
    server = app.listen();

    // Create an organizer user for testing with hashed password
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Create an artist user for testing
    const artist = await User.create({
      username: `artist-${Date.now()}`,
      password: hashedPassword,
      fullName: 'Test Artist',
      role: ['ARTIST'],
    });

    artistId = artist._id;
    console.log(`\n New Artist Created:\n`, artist); // Log the created artist

    // Generate a valid JWT token for the artist
    artistToken = jwt.sign(
      { id: artist._id, roles: ['ARTIST'] },
      process.env.JWT_KEY,
      { expiresIn: '1h' }
    );

    // Create a test festival
    const festival = await Festival.create({
      name: `Test Festival-${Date.now()}`,
      description: 'A test festival',
      dates: ['2025-06-01', '2025-06-05'],
      venue: 'Test Venue',
      organizers: [artist._id],
    });

    festivalId = festival._id;
    console.log(`\n New Festival Created:\n`, festival); // Log the created festival
  });

  afterAll(async () => {
    await mongoose.connection.close();
    server.close();
  });

  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks before each test
  });

  describe('POST /performances', () => {
    it('should return 400 if required fields are missing', async () => {
      const response = await request(server)
        .post('/performances')
        .set('Authorization', `Bearer ${artistToken}`)
        .send({
          description: 'A great performance',
          genre: 'Rock',
          duration: 120,
        }); // Missing name, bandMembers, and artists

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        'message',
        'Name, description, genre, duration, band members, and artists are required.'
      );
    });

    it('should return 400 if festival does not exist', async () => {
      const invalidFestivalId = new mongoose.Types.ObjectId();

      const response = await request(server)
        .post('/performances')
        .set('Authorization', `Bearer ${artistToken}`)
        .send({
          festivalId: invalidFestivalId,
          name: 'Nonexistent Festival Performance',
          description: 'Testing non-existent festival',
          genre: 'Jazz',
          duration: 60,
          bandMembers: [artistId],
          artists: [artistId],
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Festival not found.');
    });

    it('should return 400 if performance name is not unique', async () => {
      const duplicateName = 'Duplicate Performance';

      // Create a performance with a duplicate name
      const performance = await Performance.create({
        name: duplicateName,
        description: 'A duplicate performance',
        genre: 'Pop',
        duration: 90,
        bandMembers: [artistId],
        artists: [artistId],
        festivalId,
      });

      console.log(`\n Duplicate Performance Created:\n`, performance); // Log the created performance

      const response = await request(server)
        .post('/performances')
        .set('Authorization', `Bearer ${artistToken}`)
        .send({
          festivalId,
          name: duplicateName,
          description: 'Another performance with the same name',
          genre: 'Pop',
          duration: 90,
          bandMembers: [artistId],
          artists: [artistId],
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty(
        'message',
        'Performance name must be unique within the festival.'
      );
    });

    it('should create a performance successfully', async () => {
      const performanceData = {
        festivalId,
        name: `New Performance-${Date.now()}`,
        description: 'A fantastic performance',
        genre: 'Rock',
        duration: 120,
        bandMembers: [artistId],
        artists: [artistId],
        technicalRequirements: {
          equipment: ['Guitar amps', 'Drum kit'],
          stageSetup: 'Standard stage setup with lighting',
          soundLighting: 'Basic sound and lighting setup',
        },
        setlist: ['Song 1', 'Song 2'],
        merchandiseItems: [
          { name: 'T-shirts', description: 'A stylish t-shirt with band logo', type: 'Apparel', price: 20 },
          { name: 'Posters', price: 10, quantity: 50, type: 'Poster', description: 'Poster of the performance' },
        ],
        preferredRehearsalTimes: ['2025-05-31T10:00:00Z'],
        preferredPerformanceSlots: ['2025-06-01T20:00:00Z'],
      };

      const response = await request(server)
        .post('/performances')
        .set('Authorization', `Bearer ${artistToken}`)
        .send(performanceData);

      console.log(`\n New Performance Created:\n`, response.body); // Log the created performance

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        name: performanceData.name,
        festivalId: String(festivalId),
        technicalRequirements: performanceData.technicalRequirements,
        setlist: performanceData.setlist,
      });
      expect(response.body.bandMembers).toContain(String(artistId));
      expect(response.body.artists).toContain(String(artistId));
    });

    it('should return 500 if server error occurs', async () => {
      jest.spyOn(Performance.prototype, 'save').mockRejectedValueOnce(new Error('Internal Server Error'));

      const response = await request(server)
        .post('/performances')
        .set('Authorization', `Bearer ${artistToken}`)
        .send({
          festivalId,
          name: 'Error Performance',
          description: 'A great performance',
          genre: 'Rock',
          duration: 120,
          bandMembers: [artistId],
          artists: [artistId],
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', 'Internal Server Error');
    });
  });
});

describe('Performance API - View Scheduled Festivals', () => {
    let server;
  
    beforeAll(async () => {
      // Connect to MongoDB
      if (!mongoose.connection.readyState) {
        await mongoose.connect('mongodb://127.0.0.1:27017/festival', {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        });
      }
  
      // Start the server
      server = app.listen();
    });
  
    afterAll(async () => {
      // Disconnect from MongoDB and close the server
      await mongoose.disconnect();
      server.close();
    });
  
    describe('GET /performances/view-scheduled-performances', () => {
      it('should log only scheduled performances to the terminal output', async () => {
        // Fetch announced festivals directly from the database
        const scheduledPerformances = await Performance.find({ state: 'SCHEDULED' });
  
        const response = await request(server).get('/performances/view-scheduled-performances');
  
        // Log announced festivals to the terminal
        console.log('Scheduled Performances:', response.body.performances);
  
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message', 'Scheduled performances retrieved successfully.');
        expect(response.body).toHaveProperty('performances');
  
        // Ensure the response matches the scheduled performances in the database
        const performanceNamesInResponse = response.body.performances.map(performance => performance.name);
        const performanceNamesInDB = scheduledPerformances.map(performance => performance.name);
  
        expect(performanceNamesInResponse).toEqual(expect.arrayContaining(performanceNamesInDB));
      });
    });
  });
  
  describe('Performance API - Search Performances', () => {
    let server;
  
    beforeAll(async () => {
      // Connect to MongoDB
      if (!mongoose.connection.readyState) {
        await mongoose.connect('mongodb://127.0.0.1:27017/festival', {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        });
      }
  
      // Start the server
      server = app.listen();
    });
  
    afterAll(async () => {
      // Disconnect from MongoDB and close the server
      await mongoose.disconnect();
      server.close();
    });
  
    describe('GET /performances/search-performances', () => {
      it('should return filtered performances based on query parameters', async () => {
        // Use the existing performances already in the database
        const response = await request(server)
          .get('/performances/search-performances')
          .query({ name: 'Epic', artists: '6786b18a23db019fa3ab2bf7', genre: 'Rock' }); // Example filter parameters
  
        // Log the response to the terminal for inspection
        console.log('Search Results:', response.body.performances);
  
        // Check the response
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('message', 'Performances found.'); // Fixed message check
        expect(response.body).toHaveProperty('performances');
  
        // Ensure only 'SCHEDULED' performances are returned
        const returnedPerformances = response.body.performances;
        returnedPerformances.forEach(performance => {
          expect(performance.state).toBe('SCHEDULED');
        });
  
        // Ensure the search results match the filters
        const performanceNames = returnedPerformances.map(performance => performance.name);
        // Add assertions based on the actual data in the database
      });
  
      it('should return a 404 error if no performances match the search criteria', async () => {
        // Search for performances that do not exist based on the query parameters
        const response = await request(server)
          .get('/performances/search-performances')
          .query({ name: 'NonExistentPerformance' });
  
        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('error', 'No performances match the search criteria.'); // Fixed error message check
      });
    });
  });
  
