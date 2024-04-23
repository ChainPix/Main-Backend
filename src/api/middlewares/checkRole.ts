import { Response, NextFunction } from 'express';
import { IUserRequest } from './auth';

export const checkRole = (roles: Array<string>) => {
  return (req: IUserRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).send('Access denied.');
    }
    next();
  };
};