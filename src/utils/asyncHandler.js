/**
 * Wraps an async Express handler so any thrown/rejected error is
 * forwarded to next(error) automatically, instead of every controller
 * needing its own try/catch. Keeps controllers focused on logic.
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
