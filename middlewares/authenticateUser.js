// This file checks if a user is logged in by verifying their token

const jwt = require('jsonwebtoken');

const authenticateUser = (req, res, next) => {
  // Get the authorization token from headers
  const auth = req.headers.authorization;

  // If token not found or format is wrong
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Login required to perform this action' });
  }

  // Extract the token (remove "Bearer " part)
  const token = auth.split(' ')[1];

  try {
    // Check if the token is valid using the secret key
    const userData = jwt.verify(token, process.env.JWT_SECRET);

    // Save user info to request so we can use it later
    req.user = userData;

    // Move to the next step (controller)
    next();
  } catch (err) {
    // Token is invalid or expired
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

module.exports = { authenticateUser };
