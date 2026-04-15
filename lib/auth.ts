import jwt from 'jsonwebtoken';
import type { JwtPayload, SignOptions } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

export type AuthTokenPayload = JwtPayload & {
  role?: string;
  organisation?: string;
  email?: string;
};

export function signJwt(payload: object, expiresIn: SignOptions['expiresIn'] = '7d') {
  const options: SignOptions = { expiresIn };
  return jwt.sign(payload, JWT_SECRET, options);
}

export function verifyJwt(token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === 'string') {
      return null;
    }
    return decoded as AuthTokenPayload;
  } catch {
    return null;
  }
}
