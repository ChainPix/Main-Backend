import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../../models/user';
import { auth } from '../middlewares/auth';
import { checkRole } from '../middlewares/checkRole';
import mongoose from 'mongoose';

const router = express.Router();
export interface UserRegistration {
  name: string;
  email: string;
  role: string;
  supervisor: string;
  organization: string;
  gender: string;
}

export interface UserSignInData {
  email: string;
  uid: string;
  idToken: string;
}

// registration done by superuser
router.post('/register', auth, async (req, res) => {
  const { name, email, role, supervisor, organization, gender } = req.body as UserRegistration;
  
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // find user by email
    const user = await User.find({ email: email }).session(session);
    
    if (user.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ msg: 'User already exists' });
    }
    
    const newUser = new User({
      name,
      email,
      role,
      supervisor,
      organization,
      createdAt: new Date(),
      updatedAt: new Date(),
      gender,
      password: 'testUserPasswordWOS1234'
    });
    
    await newUser.save({ session: session });

    const newUserWithoutPassword = await User.findById(newUser._id).select('-password').session(session);
    
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({ msg: "User created successfully", newUserWithoutPassword });
  } catch (error) {
    console.error(error);
    await session.abortTransaction();
    session.endSession();
    res.status(500).send('Server error');
  }
});



router.post('/login', async (req, res) => {
  const { email, uid } = req.body as UserSignInData;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).send('Invalid Credentials');
    }
    // since the users who log into the system first time, don't have their password in the mongodb,
    // first check the user password field is empty or not
    if (user.password === "testUserPasswordWOS1234") {
      user.password = uid;
    } else {
      const isMatch = await bcrypt.compare(uid, user.password);
      if (!isMatch) {
        return res.status(400).send('Invalid Credentials');
      }
    }
    user.lastLogin = new Date();
    await user.save();
    // JWT token creation
    const payload = { user: { id: user.id } };
    jwt.sign(payload, process.env.JWT_SECRET ?? '', { expiresIn: '5h' }, (err, token) => {
      if (err) throw err;
      res.json({
        token,
        userId: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
        photoURL: user.photoURL,
        organization: user.organization
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    // req.user is assigned by the auth middleware
    const user = await User.findById(req.user!.id).select('-password');
    res.json(user);
  } catch (error: unknown) { // Specify error is of type unknown
    // Check if error is an instance of Error and has a message property
    if (error instanceof Error) {
      res.status(400).send(error.message);
    } else {
      // Handle cases where error is not an Error object
      console.error(error);
      res.status(500).send('An error occurred');
    }
  }
});

// Endpoint for to get all users without authentication
router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// Endpoint to get a user by name, if a part of the name is also given, get the related users
router.get('/search/:name',auth, async (req, res) => {
  try {
    const users = await User.find({ name: { $regex: req.params.name, $options: 'i' } }).select('-password');
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// Endpoint for to delete all users without authentication
router.delete('/', async (req, res) => {
  try {
    await User.deleteMany({});
    res.json({ msg: 'All users deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// Endpoint for to delete user by if without authentication
router.delete('/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).send('User not found');
    }
    await User.deleteOne({ _id: user._id });
    res.json({ msg: 'User removed' });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// update the role of a user to Supervisor or SuperUser without authentication
router.put('/role/:userId', async (req, res) => {
  const { role } = req.body;
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).send('User not found');
    }
    user.role = role;
    await user.save();
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// Endpoint for a super user to update a user's role or supervisor
router.put('/update/:userId', auth, checkRole(['SuperUser']), async (req, res) => {
  const { role, supervisorId } = req.body;
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).send('User not found');
    }
    if (role) user.role = role;
    if (supervisorId) user.supervisor = supervisorId; // Ensure this is a valid user ID and has a role of Supervisor
    await user.save();
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// assign a supervisor to a given user without authentication
router.put('/assign-supervisor/:userId', async (req, res) => {
  const { supervisorId } = req.body;
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).send('User not found');
    }
    const supervisor = await User.findById(supervisorId);
    if (!supervisor) {
      return res.status(404).send('Supervisor not found');
    }
    user.supervisor = supervisorId;
    await user.save();
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// update the user organization
router.put('/organization/:userId', async (req, res) => {
  const { organization } = req.body;
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).send('User not found');
    }
    user.organization = organization;
    await user.save();
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// update all the user details
router.patch('/:userId', async (req, res) => {
  const { name, email, role, photoURL, organization, gender } = req.body;
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).send('User not found');
    }
    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (photoURL) user.photoURL = photoURL;
    if (organization) user.organization = organization;
    user.updatedAt = new Date();
    if (gender) user.gender = gender;
    await user.save();
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});


/* 
  SuperUser related api routes
*/

// update the user supervisor
router.patch('/updateSupervisor/:userId', async (req, res) => {
  const { supervisorId } = req.body;
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).send('User not found');
    }
    const supervisor = await User.findById(supervisorId);
    if (!supervisor) {
      return res.status(404).send('Supervisor not found');
    }
    user.supervisor = supervisorId;
    await user.save();
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

export default router;
