export class VenueNotFoundError extends Error {
  constructor(code: string) {
    super(`Venue not found: ${code}`);
    this.name = 'VenueNotFoundError';
  }
}

/** Raised by a LanguageModel adapter when the provider declines to answer. */
export class ModelRefusalError extends Error {
  constructor(message = 'Model declined to answer') {
    super(message);
    this.name = 'ModelRefusalError';
  }
}
