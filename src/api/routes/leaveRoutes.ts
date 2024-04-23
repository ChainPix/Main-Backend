import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import Leave from '../../models/leaveRequest';
import Organization from '../../models/organization';
import User from '../../models/user';
import { auth } from '../middlewares/auth';
import { checkRole } from '../middlewares/checkRole';

const router = express.Router();

router.post('/', auth, async (req, res) => {
  const { user_id, start_date, end_date, leave_type, reason } = req.body;
  try {
    const leave = new Leave({
      user_id,
      start_date,
      end_date,
      leave_type,
      status: 'Pending',
      reason,
      date_of_request: Date.now()
    });
    await leave.save();
    res.status(201).json(leave);
  } catch (error: unknown) {
    // Check if error is an instance of Error and has a message property
    if (error instanceof Error) {
      res.status(400).send(error.message);
    } else {
      // Handle cases where error is not an Error object
      res.status(500).send('An error occurred');
    }
  }
});

// Update a leave request (approve/reject) - Only for Supervisors and SuperUsers
router.put('/:leaveId', auth, checkRole(['Supervisor', 'SuperUser']), async (req, res) => {
  const { status } = req.body;
  try {
    const leave = await Leave.findById(req.params.leaveId);
    if (!leave) {
      return res.status(404).send('Leave request not found');
    }
    leave.status = status; // Assuming status is either 'Approved' or 'Rejected'
    await leave.save();
    res.json(leave);
  } catch (error: unknown) { // Specify error is of type unknown
    // Check if error is an instance of Error and has a message property
    if (error instanceof Error) {
      res.status(400).send(error.message);
    } else {
      // Handle cases where error is not an Error object
      res.status(400).send('An error occurred');
    }
  }
});

// Fetch all leave requests
router.get('/', auth, async (req, res) => {
  try {
    // get all leave requests
    const leaves = await Leave.find();
    res.json(leaves);
  } catch (error) {
    res.status(500).send('Server Error');
  }
});

// Endpoint for supervisors to view leave requests of their direct reports
router.get('/my-reports', auth, checkRole(['Supervisor']), async (req, res) => {
  try {
    const leaves = await Leave.find({ supervisor: req.user!.id }) // Assuming Leave model includes a 'supervisor' field
      .populate('user', 'name email');
    res.json(leaves);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

router.get('/user/:userId', auth, async (req, res) => {
  try {
    const leaves = await Leave.find({ user_id: req.params.userId });
    if (!leaves) {
      return res.status(404).send('No leave requests found for the user');
    }

    // per each leave request, calculate no of leave days from start_date and end_date
    // and add it to the leave request object, remove end_date and start_date from the object
    const modifiedLeaves = leaves.map((leave: any) => {
      const start_date = new Date(leave.start_date);
      const end_date = new Date(leave.end_date);
      const days = Math.floor((end_date.getTime() - start_date.getTime()) / (1000 * 60 * 60 * 24));
      return {
        ...leave.toObject(), // Convert Mongoose document to plain JavaScript object
        no_of_days: days,
        start_date: undefined,
        end_date: undefined,
        user_id: undefined,
        __v: undefined
      };
    });

    res.json(modifiedLeaves);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

router.get('/remaining/:userId', auth, async (req, res) => {
  try {
    const user_organization = await User.findById(req.user!.id).select('organization');

    if (!user_organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }

    const user_leave_types = await Organization.findOne({ organization_id: user_organization.organization }).select('leaveTypes');

    if (!user_leave_types) {
      return res.status(404).json({ message: 'Leave types not found for the organization' });
    }

    const leaves = await Leave.find({ user_id: req.params.userId, status: 'Approved' });

    const remainingLeaves = user_leave_types.leaveTypes.map((leaveType: any) => {
      const leaveRequests = leaves.filter((leave: any) => leave.leave_type === leaveType.leave_type_name);
      const totalDays = leaveRequests.reduce((acc: number, leave: any) => {
        const start_date = new Date(leave.start_date);
        const end_date = new Date(leave.end_date);
        return acc + Math.floor((end_date.getTime() - start_date.getTime()) / (1000 * 60 * 60 * 24));
      }, 0);
      return {
        leave_type_name: leaveType.leave_type_name,
        remaining_days: leaveType.number_of_days_allowed - totalDays
      };
    });

    return res.json(remainingLeaves);

  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

// Define a common method to fetch leave requests based on status
const fetchLeavesWithMetaData = async (status: string, supervisorId?: string) => {
  const pipeline: any[] = [
    {
      $match: {
        status: status
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'user_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: '$user' },
    {
      $project: {
        leave_start_date: {
          $dateToString: { format: '%Y-%m-%d', date: '$start_date' }
        },
        leave_type: 1,
        reason: 1,
        date_of_request: {
          $dateToString: { format: '%Y-%m-%d', date: '$date_of_request' }
        },
        user_id: '$user._id',
        user_name: '$user.name',
        user_role: '$user.role',
        user_photoURL: '$user.photoURL',
        organization: '$user.organization',
        no_of_days: {
          $round: {
            $divide: [
              { $subtract: ['$end_date', '$start_date'] },
              1000 * 60 * 60 * 24 // Convert milliseconds to days
            ]
          }
        }
      }
    }
  ];

  if (supervisorId) {
    pipeline.push({
      $match: {
        'user.supervisor': new mongoose.Types.ObjectId(supervisorId)
      }
    });
  }

  return await Leave.aggregate(pipeline);
};

const fetchPendingLeaveRequestsWithMetaData = async (req: express.Request, res: express.Response, status: string) => {
  try {
    const validLeaves = await fetchLeavesWithMetaData(status, req.params.supervisorId);
    res.json(validLeaves);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
};

router.get('/pending/supervisor/:supervisorId', async (req: express.Request, res: express.Response) => {
  try {
    const supervisor = await User.findOne({
      _id: new mongoose.Types.ObjectId(req.params.supervisorId)
    });

    if (supervisor && supervisor.role === 'SuperUser') {
      const allLeaves = await fetchLeavesWithMetaData('Pending');
      res.json(allLeaves);
      return;
    }

    await fetchPendingLeaveRequestsWithMetaData(req, res, 'Pending');
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

const fetchEvaluatedLeaveRequestsWithMetaData = async (req: any, res: any) => {
  try {
    const validLeaves = await Leave.aggregate([
      // Match leaves based on user_id and status
      {
        $match: {
          user_id: { $exists: true, $ne: null },
          $or: [
            { status: 'Approved' },
            { status: 'Rejected' }
          ]
        }
      },
      // Perform a left outer join with the User collection
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      // Unwind the user array created by the $lookup stage
      { $unwind: '$user' },
      // Filter leaves where the supervisor matches the provided supervisorId
      {
        $match: {
          'user.supervisor': mongoose.Types.ObjectId.createFromHexString(req.params.supervisorId)
        }
      },
      // Perform a left outer join with the User collection to get supervisor data
      {
        $lookup: {
          from: 'users',
          localField: 'approved_by',
          foreignField: '_id',
          as: 'approved_supervisor'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'rejected_by',
          foreignField: '_id',
          as: 'rejected_supervisor'
        }
      },
      // Unwind the supervisor arrays created by the $lookup stages
      { $unwind: { path: '$approved_supervisor', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$rejected_supervisor', preserveNullAndEmptyArrays: true } },
      // Project to include the required fields and calculate no_of_days
      {
        $project: {
          leave_start_date: { $dateToString: { format: '%Y-%m-%d', date: '$start_date' } },
          leave_type: 1,
          reason: 1,
          date_of_request: { $dateToString: { format: '%Y-%m-%d', date: '$date_of_request' } },
          status: 1,
          user_id: '$user._id',
          user_name: '$user.name',
          user_role: '$user.role',
          user_photoURL: '$user.photoURL',
          organization: '$user.organization',
          no_of_days: { $divide: [{ $subtract: ['$end_date', '$start_date'] }, 1000 * 60 * 60 * 24] },
          // get status, if status is approved then get approved_date, approved_by and if status is rejected then get rejected_date, rejected_by, rejected_reason
          // if status is approved then get supervisor data using approved_by(_id, name, role, photoURL, organization) and if status is rejected then get supervisor data using rejected_by(_id, name, role, photoURL, organization)

          approved_date: { $cond: { if: { $eq: ['$status', 'Approved'] }, then: { $dateToString: { format: '%Y-%m-%d', date: '$approved_date' } }, else: null } },
          approved_by: { $cond: { if: { $eq: ['$status', 'Approved'] }, then: '$approved_supervisor', else: null } },
          rejected_date: { $cond: { if: { $eq: ['$status', 'Rejected'] }, then: { $dateToString: { format: '%Y-%m-%d', date: '$rejected_date' } }, else: null } },
          rejected_by: { $cond: { if: { $eq: ['$status', 'Rejected'] }, then: '$rejected_supervisor', else: null } },
          rejected_reason: { $cond: { if: { $eq: ['$status', 'Rejected'] }, then: '$rejected_reason', else: null } }
        }
      },
      // Project to exclude the password field of the supervisor user
      {
        $project: {
          leave_start_date: 1,
          leave_type: 1,
          reason: 1,
          date_of_request: 1,
          status: 1,
          user_id: 1,
          user_name: 1,
          user_role: 1,
          user_photoURL: 1,
          organization: 1,
          no_of_days: 1,
          approved_date: 1,
          approved_by: {
            _id: '$approved_by._id',
            name: '$approved_by.name',
            role: '$approved_by.role',
            photoURL: '$approved_by.photoURL',
            organization: '$approved_by.organization'
          },
          rejected_date: 1,
          rejected_by: {
            _id: '$rejected_by._id',
            name: '$rejected_by.name',
            role: '$rejected_by.role',
            photoURL: '$rejected_by.photoURL',
            organization: '$rejected_by.organization'
          },
          rejected_reason: 1
        }
      }
    ]);
    return res.json(validLeaves);
  } catch (error) {
    console.error(error);
    return res.status(500).send('Server Error');
  }
}

// Get all the approved or rejected leave requests from a user when the supervisorId is given
router.get('/history/supervisor/:supervisorId', auth, async (req, res) => {
  await fetchEvaluatedLeaveRequestsWithMetaData(req, res);
});


// approve a leave request by the supervisor, need to add the supervisorId, approved day to the leave request
router.patch('/approve/:leaveId', auth, async (req, res) => {
  const { approved_by } = req.body;
  try {
    const leave = await Leave.findById(req.params.leaveId);
    if (!leave) {
      return res.status(404).send('Leave request not found');
    }
    leave.status = 'Approved';
    leave.approved_date = new Date();
    leave.approved_by = approved_by;
    await leave.save();
    res.json(leave);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

// reject a leave request by the supervisor, need to add the supervisorId, rejected day to the leave request
router.patch('/reject/:leaveId', auth, async (req, res) => {
  const { rejected_by, rejected_reason } = req.body;
  try {
    const leave = await Leave.findById(req.params.leaveId);
    if (!leave) {
      return res.status(404).send('Leave request not found');
    }
    leave.status = 'Rejected';
    leave.rejected_date = new Date();
    leave.rejected_by = rejected_by;
    leave.rejected_reason = rejected_reason;
    await leave.save();
    res.json(leave);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

// patch method to update a rejected leave request to approved status by supplying relevant information
router.patch('/update/approved/:leaveId', auth, async (req, res) => {
  const { approved_by } = req.body;
  try {
    const leave = await Leave.findById(req.params.leaveId);
    if (!leave) {
      return res.status(404).send('Leave request not found');
    }
    leave.status = 'Approved';
    leave.approved_date = new Date();
    leave.approved_by = approved_by;
    leave.rejected_date = undefined;
    leave.rejected_by = undefined;
    leave.rejected_reason = undefined;
    await leave.save();
    res.json(leave);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

// patch method to update an approved leave request to rejected status by supplying relevant information
router.patch('/update/rejected/:leaveId', auth, async (req, res) => {
  const { rejected_by, rejected_reason } = req.body;
  try {
    const leave = await Leave.findById(req.params.leaveId);
    if (!leave) {
      return res.status(404).send('Leave request not found');
    }
    leave.status = 'Rejected';
    leave.rejected_date = new Date();
    leave.rejected_by = rejected_by;
    leave.rejected_reason = rejected_reason;
    leave.approved_date = undefined;
    leave.approved_by = undefined;
    await leave.save();
    res.json(leave);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});

// when the date range is given, get all the leave requests that are inside with the given date range
// using the user_id in each of leave request, get the user details and add it to the leave request object and output all the data objects
router.get('/date-range', auth, async (req: Request, res: Response) => {
  const { start_date, end_date } = req.body;

  if (!start_date || !end_date) {
    return res.status(400).json({ message: 'Both start_date and end_date are required.' });
  }

  try {
    const startDate = new Date(start_date as string);
    const endDate = new Date(end_date as string);

    // Extract only the date part from startDate and endDate
    const startDateOnly = new Date(startDate.toISOString().split('T')[0]);
    const endDateOnly = new Date(endDate.toISOString().split('T')[0]);

    // Find leaves that overlap with the given date range
    const leaves = await Leave.aggregate([
      {
        $match: {
          $or: [
            {
              $and: [
                { start_date: { $lte: endDateOnly } },
                { end_date: { $gte: startDateOnly } }
              ]
            },
            {
              $and: [
                { start_date: { $gte: startDateOnly } },
                { start_date: { $lte: endDateOnly } }
              ]
            },
            {
              $and: [
                { end_date: { $gte: startDateOnly } },
                { end_date: { $lte: endDateOnly } }
              ]
            }
          ]
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          user_id: 1,
          start_date: 1,
          end_date: 1,
          leave_type: 1,
          status: 1,
          reason: 1,
          date_of_request: 1,
          rejected_date: 1,
          approved_date: 1,
          user_name: '$user.name',
          user_email: '$user.email',
          user_role: '$user.role',
          user_photoURL: '$user.photoURL',
          user_organization: '$user.organization'
        }
      }
    ]);

    res.json(leaves);
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }
});




export default router;
