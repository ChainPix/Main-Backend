import mongoose, { Schema, Document } from 'mongoose';

interface ILeaveRequest extends Document {
    user_id: mongoose.Schema.Types.ObjectId;
    start_date: Date;
    end_date: Date;
    leave_type: string;
    status: string;
    reason?: string;
    date_of_request: Date;
    approved_date?: Date;
    approved_by?: mongoose.Schema.Types.ObjectId;
    rejected_date?: Date;
    rejected_by?: mongoose.Schema.Types.ObjectId;
    rejected_reason?: string;
}

const leaveRequestSchema: Schema = new Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    start_date: { type: Date, required: true },
    end_date: { type: Date, required: true },
    leave_type: { type: String, required: true },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    reason: { type: String, required: false },
    date_of_request: { type: Date, default: Date.now },
    approved_date: { type: Date, required: false },
    approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    rejected_date: { type: Date, required: false },
    rejected_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    rejected_reason: { type: String, required: false }
});

const LeaveRequest = mongoose.model<ILeaveRequest>('LeaveRequest', leaveRequestSchema);

export default LeaveRequest;
