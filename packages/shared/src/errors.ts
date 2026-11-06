export class QuoteSealError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, code = 'QUOTE_SEAL_ERROR', details?: unknown) {
    super(message);
    this.name = 'QuoteSealError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConfigurationError extends QuoteSealError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFIG_ERROR', details);
    this.name = 'ConfigurationError';
  }
}

export class ProfileResolutionError extends QuoteSealError {
  constructor(message: string, details?: unknown) {
    super(message, 'PROFILE_RESOLUTION_ERROR', details);
    this.name = 'ProfileResolutionError';
  }
}

export class PaymentVerificationError extends QuoteSealError {
  constructor(message: string, details?: unknown) {
    super(message, 'PAYMENT_VERIFICATION_ERROR', details);
    this.name = 'PaymentVerificationError';
  }
}

export class WorldAuthError extends QuoteSealError {
  constructor(message: string, details?: unknown) {
    super(message, 'WORLD_AUTH_ERROR', details);
    this.name = 'WorldAuthError';
  }
}

export class RotationError extends QuoteSealError {
  constructor(message: string, details?: unknown) {
    super(message, 'ROTATION_ERROR', details);
    this.name = 'RotationError';
  }
}
