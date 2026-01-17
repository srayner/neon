import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

/**
 * JWT payload for agent tokens
 */
export interface AgentTokenPayload extends JWTPayload {
  serverId: number;
  serverName: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';
const TOKEN_EXPIRY = '24h';

/**
 * Get the secret key as Uint8Array for jose
 */
function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(JWT_SECRET);
}

/**
 * Sign a JWT token for an agent
 */
export async function signAgentToken(payload: {
  serverId: number;
  serverName: string;
}): Promise<string> {
  const token = await new SignJWT({
    serverId: payload.serverId,
    serverName: payload.serverName,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .setIssuer('neon-master')
    .setSubject(`agent:${payload.serverId}`)
    .sign(getSecretKey());

  return token;
}

/**
 * Verify and decode an agent JWT token
 */
export async function verifyAgentToken(token: string): Promise<AgentTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      issuer: 'neon-master',
    });

    // Validate required fields
    if (typeof payload.serverId !== 'number' || typeof payload.serverName !== 'string') {
      return null;
    }

    return payload as AgentTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Extract bearer token from Authorization header
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Get time until token expires in seconds
 */
export function getTokenExpiresIn(payload: AgentTokenPayload): number {
  if (!payload.exp) return 0;
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, payload.exp - now);
}

/**
 * Validate the agent secret from request header
 */
export function validateAgentSecret(secretHeader: string | null): boolean {
  const expectedSecret = process.env.AGENT_SECRET;
  if (!expectedSecret) {
    console.warn('[Auth] AGENT_SECRET not configured - rejecting all registrations');
    return false;
  }
  return secretHeader === expectedSecret;
}
