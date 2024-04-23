import mongoose, { Document, Schema } from 'mongoose';
import { leaveTypeSchema } from './leaveType';

interface IOrganization extends Document {
    organization_id: string;
    leaveTypes: typeof leaveTypeSchema[];
}

const organizationSchema: Schema = new Schema({
    organization_id: { type: String, required: true, unique: true, default: mongoose.Types.ObjectId },
    leaveTypes: [leaveTypeSchema]
});

const Organization = mongoose.model<IOrganization>('Organization', organizationSchema);

export default Organization;
