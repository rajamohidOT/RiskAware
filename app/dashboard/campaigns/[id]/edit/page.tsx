import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { verifyJwt } from '@/lib/auth';
import CampaignForm from '../../../campaign-form';

type TokenPayload = {
  email?: string;
  role?: string;
  organisation?: string;
};

type EditCampaignPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditCampaignPage({ params }: EditCampaignPageProps) {
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    redirect('/dashboard');
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    redirect('/signin');
  }

  const auth = verifyJwt(token) as TokenPayload | null;
  const authEmail = typeof auth?.email === 'string' ? auth.email : '';
  const authRole = typeof auth?.role === 'string' ? auth.role : '';
  const organisation = typeof auth?.organisation === 'string' ? auth.organisation : '';

  if (!auth || authRole !== 'admin' || !authEmail || !organisation) {
    redirect('/dashboard');
  }

  const client = await clientPromise;
  const usersDb = client.db('learners');
  const campaignsDb = client.db('data');

  const admin = await usersDb.collection('users').findOne({
    email: authEmail,
    role: 'admin',
    organisation,
    status: { $ne: 'deleted' },
  });

  if (!admin) {
    redirect('/dashboard');
  }

  const campaign = await campaignsDb.collection('campaigns').findOne({
    _id: new ObjectId(id),
    organisation,
  });

  if (!campaign) {
    redirect('/dashboard');
  }

  return (
    <CampaignForm
      mode="edit"
      campaignId={id}
      title={`Edit ${campaign.type === 'training' ? 'Training' : 'Attack'} Campaign`}
      description="Update campaign details, learner audience, and assignments."
      campaignType={campaign.type === 'training' ? 'training' : 'attack'}
      assignmentLabel={campaign.type === 'training' ? 'Training Modules' : 'Simulation Steps'}
      initialValues={{
        name: typeof campaign.name === 'string' ? campaign.name : '',
        description: typeof campaign.description === 'string' ? campaign.description : '',
        startDate: typeof campaign.startDate === 'string' ? campaign.startDate : '',
        endDate: typeof campaign.endDate === 'string' ? campaign.endDate : '',
           sendTime: typeof campaign.sendTime === 'string' ? campaign.sendTime : '',
           timezone: typeof campaign.timezone === 'string' ? campaign.timezone : '',
        assignments: Array.isArray(campaign.assignments)
          ? campaign.assignments
              .map((item) => {
                if (typeof item === 'string') {
                  return item;
                }
                if (item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string') {
                  return (item as { id: string }).id;
                }
                return '';
              })
              .filter((item) => Boolean(item))
          : [],
        users: campaign.users === 'all'
          ? 'all'
          : Array.isArray(campaign.users)
            ? campaign.users.map((item) => String(item))
            : 'all',
      }}
    />
  );
}
