export abstract class QuoteSealError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      error: {
        name: this.name,
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        ...(this.details ? { details: this.details } : {})
      }
    };
  }
}

export class ValidationError extends QuoteSealError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
}

export class UnauthorizedError extends QuoteSealError {
  readonly statusCode = 401;
  readonly code = 'UNAUTHORIZED';
}

export class ForbiddenError extends QuoteSealError {
  readonly statusCode = 403;
  readonly code = 'FORBIDDEN';
}

export class NotFoundError extends QuoteSealError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';
}

export class ConflictError extends QuoteSealError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT';
}

export class SecurityHoldError extends QuoteSealError {
  readonly statusCode = 422;
  readonly code = 'SECURITY_HOLD';
}

export class SecurityBlockError extends QuoteSealError {
  readonly statusCode = 403;
  readonly code = 'SECURITY_BLOCK';
}

export class UnverifiableError extends QuoteSealError {
  readonly statusCode = 502;
  readonly code = 'UNVERIFIABLE';
}

export class ConfigurationError extends QuoteSealError {
  readonly statusCode = 500;
  readonly code = 'CONFIGURATION_ERROR';
}

export class DatabaseError extends QuoteSealError {
  readonly statusCode = 500;
  readonly code = 'DATABASE_ERROR';
}
