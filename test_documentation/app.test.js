const request = require('supertest');
const app = require('../app'); // Import the app

describe('Express App Tests', () => {
  // Test for base route - not defined in this example
  it('should return 404 for root route', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Not found');
  });
 // Test for performances route
 it('should handle GET /users (example route)', async () => {
  const res = await request(app).get('/users');
  expect(res.status).toBe(200); // Change based on the actual route logic
});
  // Test for performances route
  it('should handle GET /performances (example route)', async () => {
    const res = await request(app).get('/performances');
    expect(res.status).toBe(200); // Change based on the actual route logic
  });

  // Test for festivals route
  it('should handle GET /festivals (example route)', async () => {
    const res = await request(app).get('/festivals');
    expect(res.status).toBe(200); // Change based on the actual route logic
  });

  // Test for invalid routes
  it('should return 404 for an invalid route', async () => {
    const res = await request(app).get('/invalid-route');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Not found');
  });

  // Test for error handling middleware
  it('should return 500 for server error (example)', async () => {
    const res = await request(app).post('/festivals').send({}); // Sending invalid data
    expect(res.status).toBe(500);
    expect(res.body.error.message).toBeDefined();
  });
});
