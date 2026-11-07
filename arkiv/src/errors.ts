export class ArkivConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArkivConfigurationError';
  }
}

export class ArkivWriteError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'ArkivWriteError';
  }
}

export class ArkivQueryError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'ArkivQueryError';
  }
}

export class UntrustedArkivEntityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UntrustedArkivEntityError';
  }
}

export class ExpiredArkivEntityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExpiredArkivEntityError';
  }
}
