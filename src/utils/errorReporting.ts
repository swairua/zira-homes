/**
 * Error reporting and monitoring service
 * Centralized error handling for production monitoring
 */

import { logger } from './logger';

export interface ErrorReport {
  id: string;
  message: string;
  stack?: string;
  userId?: string;
  userAgent?: string;
  url?: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
  fingerprint?: string;
}

class ErrorReporter {
  private isProduction = process.env.NODE_ENV === 'production';
  private errorBuffer: ErrorReport[] = [];
  private maxBufferSize = 50;

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createFingerprint(error: Error, context?: Record<string, any>): string {
    // Create a unique fingerprint for error grouping
    const message = error.message.replace(/\d+/g, 'N'); // Replace numbers
    const stack = error.stack?.split('\n')[0] || '';
    const contextKey = context ? JSON.stringify(context).substring(0, 50) : '';
    return btoa(`${message}:${stack}:${contextKey}`).substring(0, 20);
  }

  private determineErrorSeverity(error: Error, context?: Record<string, any>): ErrorReport['severity'] {
    // Network/API errors
    if (error.message.includes('fetch') || error.message.includes('API')) {
      return 'medium';
    }
    
    // Authentication errors
    if (error.message.includes('auth') || error.message.includes('unauthorized')) {
      return 'high';
    }
    
    // Payment/billing errors
    if (error.message.includes('payment') || error.message.includes('billing')) {
      return 'critical';
    }
    
    // Database errors
    if (error.message.includes('database') || error.message.includes('SQL')) {
      return 'high';
    }
    
    // UI/Component errors
    if (error.message.includes('React') || error.message.includes('component')) {
      return 'medium';
    }
    
    return 'low';
  }

  reportError(
    error: any,
    context?: Record<string, any>,
    userId?: string,
    severity?: ErrorReport['severity']
  ): string {
    // Normalize non-Error inputs into an Error instance with readable message
    let normalizedError: Error;
    if (error instanceof Error) {
      normalizedError = error;
    } else {
      let message = '';
      try {
        message = typeof error === 'string' ? error : JSON.stringify(error, Object.getOwnPropertyNames(error));
      } catch (e) {
        try { message = String(error); } catch (e2) { message = 'Unserializable error object'; }
      }
      normalizedError = new Error(message);
      // Try to attach stack if available
      if (error && typeof error.stack === 'string') {
        try { (normalizedError as any).stack = error.stack; } catch (e) {}
      }
    }

    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      message: normalizedError.message,
      stack: normalizedError.stack,
      userId,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      timestamp: new Date().toISOString(),
      severity: severity || this.determineErrorSeverity(normalizedError, context),
      context,
      fingerprint: this.createFingerprint(normalizedError, context)
    };

    // Log to our logging service
    logger.error(normalizedError.message, normalizedError, {
      errorId: errorReport.id,
      severity: errorReport.severity,
      ...context
    });

    // Buffer error for external service
    this.errorBuffer.push(errorReport);
    if (this.errorBuffer.length > this.maxBufferSize) {
      this.errorBuffer.shift();
    }

    // In production, send to external error tracking service
    if (this.isProduction) {
      this.sendToExternalService(errorReport);
    }

    return errorReport.id;
  }

  private async sendToExternalService(errorReport: ErrorReport) {
    // This would integrate with services like Sentry, Bugsnag, or Rollbar
    // For now, we'll store locally and can integrate later
    try {
      // Example Sentry integration:
      // Sentry.captureException(new Error(errorReport.message), {
      //   tags: { severity: errorReport.severity },
      //   user: errorReport.userId ? { id: errorReport.userId } : undefined,
      //   contexts: { errorReport }
      // });
      
      // For now, just log that we would send this
      if (errorReport.severity === 'critical' || errorReport.severity === 'high') {
        console.error('Critical error detected:', errorReport.id, errorReport.message);
      }
    } catch (reportingError) {
      logger.error('Failed to report error to external service', reportingError);
    }
  }

  // Global error handlers
  setupGlobalErrorHandlers() {
    if (typeof window === 'undefined') return;

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      let reason = event.reason;
      if (!(reason instanceof Error)) {
        try {
          reason = new Error(typeof event.reason === 'string' ? event.reason : JSON.stringify(event.reason));
        } catch (e) {
          reason = new Error(String(event.reason));
        }
      }
      this.reportError(reason, { type: 'unhandledRejection' });
    });

    // Global JavaScript errors
    window.addEventListener('error', (event) => {
      const err = event.error || new Error(event.message);
      this.reportError(err, {
        type: 'globalError',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });
  }

  // Get buffered errors for external service integration
  getBufferedErrors(): ErrorReport[] {
    return [...this.errorBuffer];
  }

  clearBuffer() {
    this.errorBuffer.length = 0;
  }
}

export const errorReporter = new ErrorReporter();

// Initialize global error handlers
if (typeof window !== 'undefined') {
  errorReporter.setupGlobalErrorHandlers();
}

// Helper function for components to use
export const reportError = (
  error: Error,
  context?: Record<string, any>,
  userId?: string,
  severity?: ErrorReport['severity']
) => errorReporter.reportError(error, context, userId, severity);
