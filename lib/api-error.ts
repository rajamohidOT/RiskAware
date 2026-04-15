import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

type ApiErrorOptions = {
  publicMessage: string;
  status?: number;
  logMessage?: string;
};

export function handleApiError(req: NextRequest, error: unknown, options: ApiErrorOptions) {
  const requestId = req.headers.get('x-request-id') || randomUUID();

  console.error(`[${requestId}] ${options.logMessage || 'Unhandled API error'}`, error);

  return NextResponse.json(
    {
      success: false,
      message: options.publicMessage,
      requestId,
    },
    {
      status: options.status || 500,
    }
  );
}
