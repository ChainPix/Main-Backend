import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string }; // Adjust according to what you attach in auth middleware
  }
}