import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongodb';
import { deriveAttackStage, hashTrackingToken } from '@/lib/attack-tracking';
import { isValidObjectIdLike, sanitizeString } from '@/lib/security';

export async function GET(req: NextRequest) {
  try {
    const token = sanitizeString(req.nextUrl.searchParams.get('token'));
    const campaignId = sanitizeString(req.nextUrl.searchParams.get('campaignId'));

    const client = await clientPromise;
    const db = client.db('data');
    const events = db.collection('attack-simulation-events');

    if (token) {
      const tokenHash = hashTrackingToken(token);
      const record = await events.findOne(
        { tokenHash },
        { projection: { templateTitle: 1, collectsCredentials: 1 } }
      );

      if (!record) {
        return NextResponse.json({ success: false, message: 'Tracking record not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        preview: {
          templateTitle: record.templateTitle,
          collectsCredentials: Boolean(record.collectsCredentials),
        },
      });
    }

    const adminEmail = sanitizeString(req.cookies.get('session')?.value).toLowerCase();
    if (!adminEmail) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }
    if (!campaignId || !isValidObjectIdLike(campaignId)) {
      return NextResponse.json({ success: false, message: 'Valid campaignId is required' }, { status: 400 });
    }

    const usersDb = client.db('learners');
    const campaignsDb = client.db('data');

    const admin = await usersDb.collection('users').findOne({ email: adminEmail, role: 'admin', status: { $ne: 'deleted' } });
    if (!admin) {
      return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
    }

    const campaign = await campaignsDb.collection('campaigns').findOne({
      _id: new ObjectId(campaignId),
      organisation: admin.organisation || null,
      type: 'attack',
    });

    if (!campaign) {
      return NextResponse.json({ success: false, message: 'Attack campaign not found' }, { status: 404 });
    }

    const records = await events.find({ campaignId: new ObjectId(campaignId) }).sort({ sentAt: -1 }).toArray();
    const mapped = records.map((record) => ({
      id: String(record._id),
      learnerEmail: record.learnerEmail,
      learnerFirstName: record.learnerFirstName,
      templateTitle: record.templateTitle,
      stage: deriveAttackStage({
        openedAt: record.openedAt || null,
        clickedAt: record.clickedAt || null,
        reportedAt: record.reportedAt || null,
        credentialsSubmittedAt: record.credentialsSubmittedAt || null,
      }),
      sentAt: record.sentAt || null,
      openedAt: record.openedAt || null,
      clickedAt: record.clickedAt || null,
      reportedAt: record.reportedAt || null,
      credentialsSubmittedAt: record.credentialsSubmittedAt || null,
    }));

    return NextResponse.json({ success: true, records: mapped, campaign: { name: campaign.name } });
  } catch {
    return NextResponse.json({ success: false, message: 'Unable to load attack results' }, { status: 500 });
  }
}
