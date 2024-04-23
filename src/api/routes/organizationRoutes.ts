import express from 'express';
import Organization from '../../models/organization';
import { auth } from '../middlewares/auth';
const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const organizationsData: any[] = req.body;
        const createdOrganizations = await Promise.all(organizationsData.map(async (orgData: typeof Organization) => {
            const newOrganization = new Organization(orgData);
            return await newOrganization.save();
        }));

        res.status(201).json(createdOrganizations);
    } catch (error) {
        console.error('Error saving organizations:', error);
        res.status(500).json({ error: 'Failed to save organizations' });
    }
});


router.get('/', async (req, res) => {
    try {
        const organizations = await Organization.find();
        res.json(organizations);
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

router.get('/leaveTypes/:organizationId', auth, async (req, res) => {
    try {
        const organization = await Organization.findOne({ organization_id: req.params.organizationId });

        if (!organization) {
            return res.status(404).send('Organization not found');
        }
        // from each leaveType, we only need the leave_type_name
        const leaveTypes = organization.leaveTypes.map((leaveType: any) => leaveType.leave_type_name);
        res.json(leaveTypes);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});


// update leaveTypes for an organization
router.put('/:organizationId', async (req, res) => {
    const { leaveType } = req.body;
    try {
        const organization = await Organization.findById(req.params.organizationId);
        if (!organization) {
            return res.status(404).send('Organization not found');
        }
        organization.leaveTypes.push(leaveType);
        await organization.save();
        res.json(organization);
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});

router.delete('/:organizationId', async (req, res) => {
    try {
        await Organization.deleteOne({ _id: req.params.organizationId });
        res.json({ msg: 'Organization removed' });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});

export default router;