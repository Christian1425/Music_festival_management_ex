const jwt = require('jsonwebtoken');
const { Organizer } = require('../middleware/Organizer');

jest.mock('jsonwebtoken');

describe('Organizer Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {
        authorization: null,
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should return 401 if token is not provided', () => {
    Organizer(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Authorization failed: Token not provided',
    });
  });

  it('should return 401 if token is invalid', () => {
    req.headers.authorization = 'Bearer invalid_token';
    jwt.verify.mockImplementation(() => {
      const error = new Error('Invalid token');
      error.name = 'JsonWebTokenError';
      throw error;
    });

    Organizer(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invalid token',
    });
  });

  it('should return 401 if token is expired', () => {
    req.headers.authorization = 'Bearer expired_token';
    jwt.verify.mockImplementation(() => {
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      throw error;
    });

    Organizer(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Token expired',
    });
  });

  it('should return 401 if user does not have required roles', () => {
    req.headers.authorization = 'Bearer valid_token';
    jwt.verify.mockReturnValue({
      roles: ['USER'], // Roles that do not include ARTIST, ORGANIZER, or STAFF
    });

    Organizer(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Authorization failed: Only ARTIST or ORGANIZER or STAFF is allowed',
    });
  });

  it('should call next if user has the required roles', () => {
    req.headers.authorization = 'Bearer valid_token';
    jwt.verify.mockReturnValue({
      username: 'testUser',
      _id: '12345',
      roles: ['ORGANIZER'], // Valid role
    });

    Organizer(req, res, next);

    expect(req.user).toEqual({
      username: 'testUser',
      _id: '12345',
      roles: ['ORGANIZER'],
    });
    expect(next).toHaveBeenCalled();
  });
});
