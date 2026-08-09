export class AppError extends Error {
  public code: string;
  public retryable: boolean;
  public status: number;

  constructor(code: string, message: string, retryable = true, status = 500) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.retryable = retryable;
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AIProviderError extends AppError {
  constructor(message: string, retryable = true) {
    super('AI_PROVIDER_ERROR', message, retryable, 502);
  }
}

export class SourceError extends AppError {
  constructor(message: string, retryable = true) {
    super('SOURCE_ERROR', message, retryable, 502);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, retryable = false) {
    super('DATABASE_ERROR', message, retryable, 500);
  }
}

export class ContentGenerationError extends AppError {
  constructor(message: string, retryable = true) {
    super('CONTENT_GENERATION_ERROR', message, retryable, 500);
  }
}

export class PublishingError extends AppError {
  constructor(message: string, retryable = true) {
    super('PUBLISH_ERROR', message, retryable, 500);
  }
}
