import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import clientPromise from '@/lib/mongodb';
import { verifyJwt } from '@/lib/auth';
import CampaignForm from '../campaign-form';

type TokenPayload = {
  email?: string;
  role?: string;
  organisation?: string;
};

export default async function CreateTrainingPage() {
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
  const db = client.db('learners');
  const admin = await db.collection('users').findOne({
    email: authEmail,
    role: 'admin',
    organisation,
    status: { $ne: 'deleted' },
  });

  if (!admin) {
    redirect('/dashboard');
  }

  return (
    <CampaignForm
      title="Create Training Campaign"
      description="Define a training campaign, choose the learners who should receive it, and add the learning modules or tasks that make up the campaign."
      campaignType="training"
      assignmentLabel="Training Modules"
    />
  );
}
