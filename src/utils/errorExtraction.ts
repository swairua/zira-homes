/**
 * Utility for extracting meaningful error messages from various error types
 * Handles Supabase FunctionsHttpError, API errors, and generic errors
 */

export interface ErrorDetails {
  message: string;
  details?: string;
  fullError?: any;
}

/**
 * Extract a human-readable error message from various error types
 * Prioritizes specific error details over generic messages
 */
export const extractErrorMessage = (error: any): ErrorDetails => {
  // Handle null/undefined
  if (!error) {
    return { message: 'An unknown error occurred' };
  }

  // Handle Error objects
  if (error instanceof Error) {
    // Special handling for Supabase FunctionsHttpError
    if ((error as any).context) {
      try {
        const contextStr = (error as any).context;
        // Try parsing context as JSON
        const contextData = typeof contextStr === 'string'
          ? JSON.parse(contextStr)
          : contextStr;

        if (typeof contextData === 'object' && contextData !== null) {
          // Extract error from context
          if (contextData.error) {
            const errorMsg = typeof contextData.error === 'string'
              ? contextData.error
              : (contextData.error.message || 'Request failed');
            return {
              message: errorMsg,
              details: contextData.details || contextData.message || contextData.error_description,
              fullError: contextData
            };
          }

          // If no explicit error field, return stringified context
          if (Object.keys(contextData).length > 0) {
            return {
              message: JSON.stringify(contextData),
              fullError: contextData
            };
          }
        }
      } catch (e) {
        // Fall through to error.message handling
      }
    }

    // Fall back to error message
    return {
      message: error.message || 'An error occurred',
      fullError: error
    };
  }

  // Handle objects with error/message properties
  if (typeof error === 'object') {
    // Try multiple common error property names in priority order
    if (error.error) {
      const errorValue = error.error;
      const message = typeof errorValue === 'string'
        ? errorValue
        : (errorValue.message || errorValue.error || 'Request failed');
      return {
        message,
        details: error.details || error.message || error.description,
        fullError: error
      };
    }

    if (error.message) {
      const msg = error.message;
      // Avoid returning "[object Object]" or other non-useful messages
      if (msg && typeof msg === 'string' && msg !== '[object Object]') {
        return {
          message: msg,
          details: error.details || error.description,
          fullError: error
        };
      }
    }

    if (error.detail) {
      return {
        message: error.detail,
        fullError: error
      };
    }

    if (error.msg) {
      return {
        message: error.msg,
        fullError: error
      };
    }

    if (error.description) {
      return {
        message: error.description,
        fullError: error
      };
    }

    // Check for status and try to use it
    if (error.status && error.statusText) {
      return {
        message: `Error ${error.status}: ${error.statusText}`,
        details: error.message || error.detail,
        fullError: error
      };
    }

    // Try common response structures
    if (error.response) {
      const response = error.response;
      if (response.data?.error) {
        return {
          message: typeof response.data.error === 'string'
            ? response.data.error
            : response.data.error.message || 'Request failed',
          details: response.data.details || response.data.message,
          fullError: error
        };
      }
      if (response.statusText) {
        return {
          message: `Error ${response.status}: ${response.statusText}`,
          fullError: error
        };
      }
    }

    // Try to get useful properties
    const keys = Object.keys(error).filter(k => typeof error[k] === 'string');
    if (keys.length > 0) {
      const firstKey = keys[0];
      const value = error[firstKey];
      if (value && value !== '[object Object]') {
        return {
          message: value,
          fullError: error
        };
      }
    }

    // Last resort: stringify (but avoid [object Object])
    const stringified = JSON.stringify(error);
    if (stringified && stringified !== '{}' && stringified !== '[object Object]') {
      return {
        message: stringified,
        fullError: error
      };
    }
  }

  // Handle string errors
  if (typeof error === 'string') {
    return { message: error };
  }

  // Fallback
  return { message: 'An unknown error occurred' };
};

/**
 * Format error message for user display
 * Combines main message and details if available
 */
export const formatErrorForDisplay = (error: any): string => {
  const { message, details } = extractErrorMessage(error);
  
  if (details && details !== message) {
    return `${message}\n\nDetails: ${details}`;
  }
  
  return message;
};

/**
 * Log full error details for debugging
 */
export const logErrorDetails = (error: any, context?: string) => {
  const { message, details, fullError } = extractErrorMessage(error);

  console.error(`[Error${context ? ` - ${context}` : ''}]`, {
    message,
    details,
    original: fullError || error,
    timestamp: new Date().toISOString()
  });
};

/**
 * Safe string conversion that avoids [object Object]
 */
export const toErrorString = (value: any): string => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Error) {
    return value.message || String(value);
  }

  if (typeof value === 'object') {
    // Try to extract a meaningful string from the object in priority order
    if (value.message && typeof value.message === 'string' && value.message !== '[object Object]') {
      return value.message;
    }
    if (value.error && typeof value.error === 'string' && value.error !== '[object Object]') {
      return value.error;
    }
    if (value.detail && typeof value.detail === 'string' && value.detail !== '[object Object]') {
      return value.detail;
    }
    if (value.msg && typeof value.msg === 'string' && value.msg !== '[object Object]') {
      return value.msg;
    }
    if (value.description && typeof value.description === 'string' && value.description !== '[object Object]') {
      return value.description;
    }
    if (value.ResponseDescription && typeof value.ResponseDescription === 'string' && value.ResponseDescription !== '[object Object]') {
      return value.ResponseDescription;
    }

    // Try JSON stringify as last resort
    try {
      const str = JSON.stringify(value);
      if (str && str !== '{}' && str !== '[object Object]') {
        return str;
      }
    } catch (e) {
      // Continue to fallback
    }
  }

  // Fallback to String conversion but avoid [object Object]
  const str = String(value);
  return str && str !== '[object Object]' ? str : '';
};
