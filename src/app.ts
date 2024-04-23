import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import userRoutes from './api/routes/userRoutes';
import leaveRoutes from './api/routes/leaveRoutes';
import organizationRoutes from './api/routes/organizationRoutes';

dotenv.config();

export const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
}));

app.use(express.json());



mongoose.connect(process.env.MONGODB_URI as string)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB:', err));

app.use('/api/users', userRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/organizations', organizationRoutes);
