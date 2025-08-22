const { ValidationError } = require('../middleware/errorHandler');

// Validation middleware factory
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      let data;
      
      switch (source) {
        case 'body':
          data = req.body;
          break;
        case 'query':
          data = req.query;
          break;
        case 'params':
          data = req.params;
          break;
        case 'headers':
          data = req.headers;
          break;
        default:
          data = req.body;
      }

      const result = schema.parse(data);
      
      // Replace the original data with validated data
      if (source === 'body') {
        req.body = result;
      } else if (source === 'query') {
        req.query = result;
      } else if (source === 'params') {
        req.params = result;
      }
      
      next();
    } catch (error) {
      if (error.name === 'ZodError') {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
          received: err.received
        }));
        
        next(new ValidationError('Validation failed', errors));
      } else {
        next(error);
      }
    }
  };
};

// Validate multiple sources
const validateMultiple = (schemas) => {
  return (req, res, next) => {
    try {
      const errors = [];
      
      for (const [source, schema] of Object.entries(schemas)) {
        let data;
        
        switch (source) {
          case 'body':
            data = req.body;
            break;
          case 'query':
            data = req.query;
            break;
          case 'params':
            data = req.params;
            break;
          case 'headers':
            data = req.headers;
            break;
          default:
            continue;
        }

        try {
          const result = schema.parse(data);
          
          // Replace with validated data
          if (source === 'body') {
            req.body = result;
          } else if (source === 'query') {
            req.query = result;
          } else if (source === 'params') {
            req.params = result;
          }
        } catch (validationError) {
          if (validationError.name === 'ZodError') {
            const sourceErrors = validationError.errors.map(err => ({
              field: `${source}.${err.path.join('.')}`,
              message: err.message,
              code: err.code,
              received: err.received
            }));
            errors.push(...sourceErrors);
          }
        }
      }
      
      if (errors.length > 0) {
        next(new ValidationError('Validation failed', errors));
      } else {
        next();
      }
    } catch (error) {
      next(error);
    }
  };
};

// Optional validation (doesn't fail if data is missing)
const validateOptional = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      let data;
      
      switch (source) {
        case 'body':
          data = req.body;
          break;
        case 'query':
          data = req.query;
          break;
        case 'params':
          data = req.params;
          break;
        case 'headers':
          data = req.headers;
          break;
        default:
          data = req.body;
      }

      // Skip validation if no data provided
      if (!data || Object.keys(data).length === 0) {
        return next();
      }

      const result = schema.parse(data);
      
      // Replace the original data with validated data
      if (source === 'body') {
        req.body = result;
      } else if (source === 'query') {
        req.query = result;
      } else if (source === 'params') {
        req.params = result;
      }
      
      next();
    } catch (error) {
      if (error.name === 'ZodError') {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
          received: err.received
        }));
        
        next(new ValidationError('Validation failed', errors));
      } else {
        next(error);
      }
    }
  };
};

// Transform and validate query parameters
const validateQueryParams = (transformers = {}) => {
  return (req, res, next) => {
    try {
      for (const [key, transformer] of Object.entries(transformers)) {
        if (req.query[key] !== undefined) {
          req.query[key] = transformer(req.query[key]);
        }
      }
      next();
    } catch (error) {
      next(new ValidationError(`Invalid query parameter: ${error.message}`));
    }
  };
};

// Sanitize input data
const sanitize = (options = {}) => {
  const {
    trimStrings = true,
    removeEmptyStrings = true,
    removeNullValues = false
  } = options;

  return (req, res, next) => {
    try {
      const sanitizeObject = (obj) => {
        if (Array.isArray(obj)) {
          return obj.map(sanitizeObject);
        }
        
        if (obj !== null && typeof obj === 'object') {
          const sanitized = {};
          
          for (const [key, value] of Object.entries(obj)) {
            let sanitizedValue = sanitizeObject(value);
            
            // Skip null values if requested
            if (removeNullValues && sanitizedValue === null) {
              continue;
            }
            
            // Skip empty strings if requested
            if (removeEmptyStrings && sanitizedValue === '') {
              continue;
            }
            
            sanitized[key] = sanitizedValue;
          }
          
          return sanitized;
        }
        
        if (typeof obj === 'string') {
          let sanitized = obj;
          
          if (trimStrings) {
            sanitized = sanitized.trim();
          }
          
          return sanitized;
        }
        
        return obj;
      };

      req.body = sanitizeObject(req.body || {});
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  validate,
  validateMultiple,
  validateOptional,
  validateQueryParams,
  sanitize
};