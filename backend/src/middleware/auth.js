const jwt = require("jsonwebtoken");
const User = require("../models/User");
/*
const protect = async (req, res, next) => {
  let token;

  // Check if authorization header exists and has the correct format
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    try {
      // Extract the token from the authorization header
      token = req.headers["authorization"].split(" ")[1];

      // Check if the token is in valid JWT format (should have 3 parts)
      if (!token || token.split(".").length !== 3) {
        return res.status(401).json({ message: "Malformed token" });
      }

      // Verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if the user still exists in the database
      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Attach user to request object
      req.user = user;

      next(); // Token is valid and user exists, proceed with the request
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Token has expired" });
      }

      console.error("Token verification error:", error);
      return res.status(401).json({ message: "Not authorized, token failed" });
    }
  } else {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
};*/

const protect = async (req, res, next) => {
  if (req.headers && req.headers.authorization) {
    const token = req.headers.authorization.split(" ")[1];
    try {
      const decode = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decode.id);

      if (!user) {
        return res.json({
          success: false,
          message: "unauthorized access! No user found",
        });
      }
      req.user = user;
      next();
    } catch (error) {
      if (error.name === "JsonWebTokenError") {
        return res.json({
          success: false,
          message: "unauthorized access! token error",
        });
      }
      if (error.name === "TokenExpiredError") {
        return res.json({
          success: false,
          message: "Session expired, try sign in",
        });
      }
      res.json({ success: false, message: "Internal server error" });
    }
  } else {
    res.json({ success: false, message: "unauthorized access! header" });
  }
};

module.exports = { protect };
