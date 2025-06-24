const jwt = require("jsonwebtoken");
const config = require("config");

module.exports = function (req, res, next) {
  // Get token from header
  const token = req.header("Authorization");

  // Check if no token
  if (!token) {
    return res.status(401).json({ msg: "No token, authorization denied" });
  }

  // Check if it's Bearer token format
  if (token.startsWith('Bearer ')) {
    // Remove 'Bearer ' prefix
    const tokenValue = token.slice(7);
    
    // Verify token
    try {
      const decoded = jwt.verify(tokenValue, config.get("JWT_SECRET"));
      req.user = decoded.user;
      next();
    } catch (err) {
      res.status(401).json({ msg: "Invalid token" });
    }
  } else {
    // Verify token without Bearer prefix (for backward compatibility)
    try {
      const decoded = jwt.verify(token, config.get("JWT_SECRET"));
      req.user = decoded.user;
      next();
    } catch (err) {
      res.status(401).json({ msg: "Invalid token" });
    }
  }
};
