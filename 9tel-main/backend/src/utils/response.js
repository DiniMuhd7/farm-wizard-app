const goodResponse = (res, message, data, status) => {
  res.status(status).json({
    success: true,
    message,
    data,
  });
};

const badResponse = (res, message, error, status) => {
  res.status(status).json({
    success: false,
    message,
    error,
  });
};

module.exports = {
  goodResponse,
  badResponse,
};
