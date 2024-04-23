import { Document, Schema } from 'mongoose';

interface ILeaveType extends Document {
    leave_type_id: string;
    leave_type_name: string;
    number_of_days_allowed: number;
    monthly?: boolean;
}

export const leaveTypeSchema = new Schema<ILeaveType>({
    leave_type_id: { type: String, required: true },
    leave_type_name: { type: String, required: true },
    number_of_days_allowed: { type: Number, required: true },
}, {
    _id: false
});