const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

/**
 * Configure security middleware
 */
const configureSecurity = (app) => {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));
};

/**
 * Configure CORS
 */
const configureCORS = (app) => {
  app.use(cors({
    origin: true, // Allow all origins in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));
};

/**
 * Configure rate limiting
 */
const configureRateLimit = (app) => {
  // Rate limiting (enabled only in production to avoid interfering with local dashboards)
  if (process.env.NODE_ENV === 'production') {
    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000, // 1 minute
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000) / 1000 / 60)
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => req.path === '/api/auth/me'
    });

    const speedLimiter = slowDown({
      windowMs: 15 * 60 * 1000,
      delayAfter: 200, // higher threshold in production
      delayMs: () => 250
    });

    app.use(limiter);
    app.use(speedLimiter);
  }
};

/**
 * Configure body parsing
 */
const configureBodyParsing = (app) => {
  app.use(require('express').json({ limit: '10mb' }));
  app.use(require('express').urlencoded({ extended: true, limit: '10mb' }));
};

/**
 * Configure compression
 */
const configureCompression = (app) => {
  app.use(compression());
};

/**
 * Configure logging
 */
const configureLogging = (app) => {
  if (process.env.NODE_ENV === 'development') {
    // Only log errors (4xx and 5xx responses)
    app.use(morgan('dev', {
      skip: function (req, res) { return res.statusCode < 400; }
    }));
  } else {
    app.use(morgan('combined', {
      skip: function (req, res) { return res.statusCode < 400; }
    }));
  }
};

/**
 * Configure all middleware
 */
const configureMiddleware = (app) => {
  configureSecurity(app);
  configureCORS(app);
  configureRateLimit(app);
  configureBodyParsing(app);
  configureCompression(app);
  configureLogging(app);
};

module.exports = {
  configureMiddleware,
  configureSecurity,
  configureCORS,
  configureRateLimit,
  configureBodyParsing,
  configureCompression,
  configureLogging
};
