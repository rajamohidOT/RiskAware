import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import clientPromise from '@/lib/mongodb';
import { verifyJwt } from '@/lib/auth';
import UsersClient from './users-client';

type TokenPayload = {
  email?: string;
  role?: string;
  organisation?: string;
};

export default async function UsersPage() {
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

  return <UsersClient organisation={organisation} />;
}
