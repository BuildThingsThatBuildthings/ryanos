#!/usr/bin/env node
/**
 * Health Check Script for Fitness Tracker Backend
 * This script provides comprehensive health checks for the application
 */

const http = require('http');
const https = require('https');
const { promisify } = require('util');

// Configuration
const config = {
  host: process.env.HEALTH_CHECK_HOST || 'localhost',
  port: process.env.PORT || 3000,
  path: process.env.HEALTH_CHECK_PATH || '/health',
  protocol: process.env.HEALTH_CHECK_PROTOCOL || 'http',
  timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 10000,
  retries: parseInt(process.env.HEALTH_CHECK_RETRIES) || 3,
  retryDelay: parseInt(process.env.HEALTH_CHECK_RETRY_DELAY) || 1000,
  verbose: process.env.HEALTH_CHECK_VERBOSE === 'true'
};

// Health check categories
const HEALTH_CHECKS = {
  BASIC: 'basic',
  DATABASE: 'database',
  REDIS: 'redis',
  EXTERNAL: 'external',
  BUSINESS: 'business'
};

// Exit codes
const EXIT_CODES = {
  SUCCESS: 0,
  HTTP_ERROR: 1,
  TIMEOUT: 2,
  CONNECTION_ERROR: 3,
  INVALID_RESPONSE: 4,
  HEALTH_CHECK_FAILED: 5
};

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Logging functions
const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  error: (msg) => console.error(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  debug: (msg) => config.verbose && console.log(`${colors.cyan}[DEBUG]${colors.reset} ${msg}`)
};

// Sleep utility
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// HTTP request utility
function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const client = options.protocol === 'https' ? https : http;
    const startTime = Date.now();
    
    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        
        try {
          const parsedData = data ? JSON.parse(data) : {};
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsedData,
            responseTime,
            rawData: data
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data,
            responseTime,
            rawData: data,
            parseError: error.message
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.setTimeout(options.timeout || config.timeout);
    req.end();
  });
}

// Main health check function
async function performHealthCheck() {
  log.info(`Starting health check for ${config.protocol}://${config.host}:${config.port}${config.path}`);
  
  const requestOptions = {
    hostname: config.host,
    port: config.port,
    path: config.path,
    method: 'GET',
    protocol: config.protocol === 'https' ? 'https:' : 'http:',
    timeout: config.timeout,
    headers: {
      'User-Agent': 'HealthCheck/1.0',
      'Accept': 'application/json'
    }
  };
  
  let attempt = 0;
  let lastError;
  
  while (attempt < config.retries) {
    attempt++;
    
    try {
      log.debug(`Health check attempt ${attempt}/${config.retries}`);
      
      const response = await makeRequest(requestOptions);
      
      log.debug(`Response status: ${response.statusCode}`);
      log.debug(`Response time: ${response.responseTime}ms`);
      
      if (response.statusCode === 200) {
        return analyzeHealthResponse(response);
      } else {
        throw new Error(`HTTP ${response.statusCode}: ${response.rawData}`);
      }
      
    } catch (error) {
      lastError = error;
      log.warn(`Health check attempt ${attempt} failed: ${error.message}`);
      
      if (attempt < config.retries) {
        log.debug(`Retrying in ${config.retryDelay}ms...`);
        await sleep(config.retryDelay);
      }
    }
  }
  
  // All attempts failed
  if (lastError.code === 'ECONNREFUSED') {
    log.error('Connection refused - service may be down');
    process.exit(EXIT_CODES.CONNECTION_ERROR);
  } else if (lastError.message.includes('timeout')) {
    log.error('Request timeout - service may be overloaded');
    process.exit(EXIT_CODES.TIMEOUT);
  } else {
    log.error(`Health check failed after ${config.retries} attempts: ${lastError.message}`);
    process.exit(EXIT_CODES.HTTP_ERROR);
  }
}

// Analyze health response
function analyzeHealthResponse(response) {
  log.success(`Health check successful (${response.responseTime}ms)`);
  
  if (!response.data || typeof response.data !== 'object') {
    log.warn('Invalid health response format');
    if (config.verbose) {
      console.log('Raw response:', response.rawData);
    }
    process.exit(EXIT_CODES.INVALID_RESPONSE);
  }
  
  const healthData = response.data;
  
  // Basic validation
  if (!healthData.status) {
    log.error('Health response missing status field');
    process.exit(EXIT_CODES.INVALID_RESPONSE);
  }
  
  if (healthData.status !== 'healthy') {
    log.error(`Service is not healthy: ${healthData.status}`);
    if (healthData.message) {
      log.error(`Message: ${healthData.message}`);
    }
    process.exit(EXIT_CODES.HEALTH_CHECK_FAILED);
  }
  
  // Detailed analysis
  analyzeDetailedHealth(healthData, response.responseTime);
  
  log.success('All health checks passed');
  return healthData;
}

// Analyze detailed health information
function analyzeDetailedHealth(healthData, responseTime) {
  const { timestamp, uptime, version, checks = {} } = healthData;
  
  // Basic info
  log.info(`Service: ${version || 'unknown version'}`);
  log.info(`Uptime: ${formatUptime(uptime)}`);
  log.info(`Response time: ${responseTime}ms`);
  
  if (timestamp) {
    const age = Date.now() - new Date(timestamp).getTime();
    log.info(`Health data age: ${age}ms`);
    
    if (age > 30000) { // 30 seconds
      log.warn('Health data is stale (older than 30 seconds)');
    }
  }
  
  // Analyze individual checks
  const failedChecks = [];
  const warningChecks = [];
  
  Object.entries(checks).forEach(([checkName, checkResult]) => {
    if (typeof checkResult === 'object') {
      const { status, message, responseTime: checkTime } = checkResult;
      
      switch (status) {
        case 'healthy':
          log.success(`${checkName}: OK${checkTime ? ` (${checkTime}ms)` : ''}`);
          break;
        case 'warning':
          log.warn(`${checkName}: Warning - ${message || 'No details'}`);
          warningChecks.push(checkName);
          break;
        case 'unhealthy':
          log.error(`${checkName}: Failed - ${message || 'No details'}`);
          failedChecks.push(checkName);
          break;
        default:
          log.warn(`${checkName}: Unknown status - ${status}`);
          warningChecks.push(checkName);
      }
    } else {
      log.debug(`${checkName}: ${checkResult}`);
    }
  });
  
  // Summary
  const totalChecks = Object.keys(checks).length;
  const healthyChecks = totalChecks - failedChecks.length - warningChecks.length;
  
  log.info(`Health check summary: ${healthyChecks}/${totalChecks} healthy, ${warningChecks.length} warnings, ${failedChecks.length} failed`);
  
  if (failedChecks.length > 0) {
    log.error(`Failed checks: ${failedChecks.join(', ')}`);
    process.exit(EXIT_CODES.HEALTH_CHECK_FAILED);
  }
  
  if (warningChecks.length > 0) {
    log.warn(`Warning checks: ${warningChecks.join(', ')}`);
    // Don't exit for warnings, but log them
  }
}

// Format uptime in human-readable format
function formatUptime(uptimeSeconds) {
  if (!uptimeSeconds) return 'unknown';
  
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  
  return parts.join(' ');
}

// Command line argument parsing
function parseArgs() {
  const args = process.argv.slice(2);
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      case '--verbose':
      case '-v':
        config.verbose = true;
        break;
      case '--host':
        config.host = args[++i];
        break;
      case '--port':
        config.port = parseInt(args[++i]);
        break;
      case '--path':
        config.path = args[++i];
        break;
      case '--protocol':
        config.protocol = args[++i];
        break;
      case '--timeout':
        config.timeout = parseInt(args[++i]) * 1000; // Convert to ms
        break;
      case '--retries':
        config.retries = parseInt(args[++i]);
        break;
      default:
        if (arg.startsWith('-')) {
          log.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }
}

// Print help information
function printHelp() {
  console.log(`
Health Check Script for Fitness Tracker

Usage: node healthcheck.js [options]

Options:
  -h, --help          Show this help message
  -v, --verbose       Enable verbose output
  --host HOST         Target host (default: ${config.host})
  --port PORT         Target port (default: ${config.port})
  --path PATH         Health check path (default: ${config.path})
  --protocol PROTO    Protocol (http|https) (default: ${config.protocol})
  --timeout SECONDS   Timeout in seconds (default: ${config.timeout / 1000})
  --retries COUNT     Number of retries (default: ${config.retries})

Environment Variables:
  HEALTH_CHECK_HOST
  PORT
  HEALTH_CHECK_PATH
  HEALTH_CHECK_PROTOCOL
  HEALTH_CHECK_TIMEOUT
  HEALTH_CHECK_RETRIES
  HEALTH_CHECK_RETRY_DELAY
  HEALTH_CHECK_VERBOSE

Exit Codes:
  0 - Success
  1 - HTTP Error
  2 - Timeout
  3 - Connection Error
  4 - Invalid Response
  5 - Health Check Failed

Examples:
  node healthcheck.js
  node healthcheck.js --host backend-service --port 3000
  node healthcheck.js --verbose --timeout 30
  `);
}

// Error handling
process.on('uncaughtException', (error) => {
  log.error(`Uncaught exception: ${error.message}`);
  if (config.verbose) {
    console.error(error.stack);
  }
  process.exit(EXIT_CODES.CONNECTION_ERROR);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error(`Unhandled rejection: ${reason}`);
  if (config.verbose) {
    console.error('Promise:', promise);
  }
  process.exit(EXIT_CODES.CONNECTION_ERROR);
});

// Main execution
async function main() {
  parseArgs();
  
  try {
    const healthData = await performHealthCheck();
    
    if (config.verbose) {
      console.log('\nFull health data:');
      console.log(JSON.stringify(healthData, null, 2));
    }
    
    process.exit(EXIT_CODES.SUCCESS);
  } catch (error) {
    log.error(`Health check failed: ${error.message}`);
    if (config.verbose) {
      console.error(error.stack);
    }
    process.exit(EXIT_CODES.CONNECTION_ERROR);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  performHealthCheck,
  analyzeHealthResponse,
  EXIT_CODES
};