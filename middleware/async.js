const asyncHandler = (fn) => (req, res, next) => {
  // Resolve the promise returned by the controller function
  // and pass any errors to the error handling middleware
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
