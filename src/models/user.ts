import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: string; // 'Normal', 'Supervisor', 'SuperUser'
  photoURL?: string;
  supervisor?: mongoose.Schema.Types.ObjectId; // Reference to the user's supervisor, if applicable
  organization: string;
  createdAt: Date;
  updatedAt: Date;
  lastLogin: Date;
  gender: string; // 'Male', 'Female', 'Other'
}

const userSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true },
  photoURL: { type: String, required: false },
  supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  organization: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now },
  gender: { type: String, required: true }
});

userSchema.pre<IUser>('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

const User = mongoose.model<IUser>('User', userSchema);

export default User;
