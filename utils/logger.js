/**
 * Logging utilities
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

const log = {
  info: (message, ...args) => {
    console.log(`${colors.blue}ℹ${colors.reset} ${message}`, ...args);
  },
  
  success: (message, ...args) => {
    console.log(`${colors.green}✓${colors.reset} ${message}`, ...args);
  },
  
  warning: (message, ...args) => {
    console.log(`${colors.yellow}⚠${colors.reset} ${message}`, ...args);
  },
  
  error: (message, ...args) => {
    console.error(`${colors.red}✗${colors.reset} ${message}`, ...args);
  },
  
  debug: (message, ...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`${colors.dim}🐛${colors.reset} ${message}`, ...args);
    }
  }
};

module.exports = { log };
