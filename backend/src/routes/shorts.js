const express = require("express");
const { getShorts } = require("../controllers/shorts");

const router = express.Router();

router.get("/", getShorts);

module.exports = router;
