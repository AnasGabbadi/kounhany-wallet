const errorMiddleware = (err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[${status}] ${req.method} ${req.path} — ${message}`);
  }

  res.status(status).json({
    success: false,
    message,
  });
};

module.exports = errorMiddleware;