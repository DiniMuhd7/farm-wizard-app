const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  if (req.headers && req.headers.authorization) {
    const token = req.headers.authorization.split(" ")[1];
    try {
      const decode = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decode.id);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "unauthorized access! No user found",
        });
      }
      req.user = user;
      next();
    } catch (error) {
      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({
          success: false,
          message: "unauthorized access! token error",
        });
      }
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Session expired, try sign in",
        });
      }
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  } else {
    return res.status(401).json({ success: false, message: "unauthorized access! header" });
  }
};

module.exports = { protect };
