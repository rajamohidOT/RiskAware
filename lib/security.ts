import { NextRequest, NextResponse } from 'next/server';

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

type RateLimitConfig = {
  keyPrefix: string;
  limit: number;
  windowMs: number;
};

export function getClientIp(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return req.headers.get('x-real-ip') || 'unknown';
}

export function enforceRateLimit(req: NextRequest, config: RateLimitConfig) {
  const ip = getClientIp(req);
  const key = `${config.keyPrefix}:${ip}`;
  const now = Date.now();

  const existing = rateLimitStore.get(key);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return null;
  }

  if (existing.count >= config.limit) {
    const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);
    return NextResponse.json(
      {
        success: false,
        message: 'Too many requests. Please try again later.',
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds),
        },
      }
    );
  }

  existing.count += 1;
  rateLimitStore.set(key, existing);
  return null;
}

export function sanitizeString(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/[\u0000-\u001F\u007F]/g, '').trim();
}

export function sanitizeHtml(value: unknown) {
  const input = sanitizeString(value);
  return input.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
}

export function sanitizeObject<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item)) as T;
  }

  if (obj && typeof obj === 'object') {
    const sanitizedEntries = Object.entries(obj as Record<string, unknown>).map(([key, value]) => [
      key,
      sanitizeObject(value),
    ]);
    return Object.fromEntries(sanitizedEntries) as T;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj) as T;
  }

  return obj;
}

export function isNonEmptyString(value: unknown) {
  return typeof value === 'string' && sanitizeString(value).length > 0;
}

export function isEmail(value: unknown) {
  if (!isNonEmptyString(value)) {
    return false;
  }

  const email = sanitizeString(value).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidObjectIdLike(value: unknown) {
  return typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
}
