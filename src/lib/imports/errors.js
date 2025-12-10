export class ImportFailure extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ImportFailure';
    this.status = options.status ?? 400;
    this.details = options.details ?? null;
  }
}
