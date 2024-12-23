import { Verbose } from '../services.js'

const verbose = Verbose('sd:middleware/errors'); verbose('')

// catch 404 and forward to error handler.
export const error404 = (req, res, next) => {
  const err = new Error('Not Found')
  err.status = 404
  next(err)
}

// If our applicatione encounters an error, we'll display the error and
// stacktrace accordingly.
export const sendError = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err)
  }
  verbose('Send Error:', err)
  res.status(err.statusCode || err.status || err.code || 500).json(err)
}
