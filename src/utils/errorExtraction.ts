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
    return {
      message: error.message || 'An error occurred',
      fullError: error
    };
  }

  // Handle FunctionsHttpError or similar objects with context/json
  if (error.context) {
    try {
      const contextData = typeof error.context === 'string' 
        ? JSON.parse(error.context) 
        : error.context;
      
      if (contextData.error) {
        return {
          message: contextData.error,
          details: contextData.details || contextData.message,
          fullError: contextData
        };
      }
    } catch (e) {
      // Fall through to other checks
    }
  }

  // Handle objects with error/message properties
  if (typeof error === 'object') {
    // Try multiple common error property names
    if (error.error) {
      return {
        message: typeof error.error === 'string' ? error.error : error.error.message || 'Request failed',
        details: error.details || error.message,
        fullError: error
      };
    }

    if (error.message) {
      return {
        message: error.message,
        details: error.details || error.description,
        fullError: error
      };
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

    // Try to stringify as last resort
    const stringified = JSON.stringify(error);
    if (stringified && stringified !== '{}') {
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
