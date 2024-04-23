import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import User from '../../models/user';

export interface IUserRequest extends Request {
    user?: any;
}

export const auth = async (req: IUserRequest, res: Response, next: NextFunction) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            throw new Error('No token found');
        }

        const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);
        const user = await User.findById(decoded.user.id);
        if (!user) {
            throw new Error();
        }

        req.user = user;
        next();
    } catch (e) {
        res.status(401).send({ message: 'Please authenticate. ' + e });
    }
};

