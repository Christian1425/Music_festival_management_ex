const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');
const User = require('../models/User');

jest.setTimeout(60000); // Extend timeout for DB operations

process.env.JWT_KEY = 'testsecret'; // Set JWT secret for tests

describe('User API', () => {
  let server;

  beforeAll(async () => {
    server = app.listen(); // Use dynamic port
  });

  afterAll(async () => {
    await mongoose.connection.close(); // Close DB connection
    server.close(); // Stop server
  });

  describe('POST /signup', () => {
    it('should create a new user', async () => {
      const newUser = {
        username: `testuser-${Date.now()}`, // Ensure unique username
        password: 'password123',
        fullName: 'Test User',
        role: ['ORGANIZER']
      };

      const response = await request(server).post('/users/signup').send(newUser);
      console.log('Signup Success:', response.body); // Log the created object
    });

    it('should return error for missing fields', async () => {
      const response = await request(server).post('/users/signup').send({
        username: 'incompleteuser'
      });
      console.log('Signup Error (Missing Fields):', response.body); // Log error for missing fields
    });
  });

  describe('POST /login', () => {
    it('should log in a user with correct credentials', async () => {
      const newUser = {
        username: 'testuser',
        password: 'password123',
        fullName: 'Test User',
        role: ['ORGANIZER']
      };

      await request(server).post('/users/signup').send(newUser);

      const response = await request(server)
        .post('/users/login')
        .send({ username: 'testuser', password: 'password123' });

      console.log('Login Success:', response.body); // Log the successful login
    });

    it('should return error for invalid credentials', async () => {
      const response = await request(server)
        .post('/users/login')
        .send({ username: 'testuser', password: 'wrongpassword' });

      console.log('Login Error (Invalid Credentials):', response.body); // Log error for wrong credentials
    });
  });

  describe('POST /logout', () => {
    it('should log out a user', async () => {
      const newUser = {
        username: 'testuser',
        password: 'password123',
        fullName: 'Test User',
        role: ['ORGANIZER']
      };

      await request(server).post('/users/signup').send(newUser);

      const loginResponse = await request(server)
        .post('/users/login')
        .send({ username: 'testuser', password: 'password123' });

      const token = loginResponse.body.token;

      const logoutResponse = await request(server)
        .post('/users/logout')
        .set('Authorization', `Bearer ${token}`);

      console.log('Logout Success:', logoutResponse.body); // Log the successful logout
    });
  });
});
