/**
 * Phone Authentication Session Management
 *
 * Handles session storage and retrieval for phone-authenticated users
 */

const PHONE_SESSION_KEY = 'phone_auth_session';

export interface PhoneSession {
  userId: string;
  phoneNumber: string;
  expiresAt: number;
}

/**
 * Store phone authentication session
 */
export function setPhoneSession(userId: string, phoneNumber: string): void {
  const session: PhoneSession = {
    userId,
    phoneNumber,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem(PHONE_SESSION_KEY, JSON.stringify(session));
  }
}

/**
 * Get phone authentication session
 */
export function getPhoneSession(): PhoneSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const sessionData = localStorage.getItem(PHONE_SESSION_KEY);
  if (!sessionData) {
    return null;
  }

  try {
    const session: PhoneSession = JSON.parse(sessionData);

    if (session.expiresAt < Date.now()) {
      clearPhoneSession();
      return null;
    }

    return session;
  } catch (error) {
    console.error('Error parsing phone session:', error);
    clearPhoneSession();
    return null;
  }
}

/**
 * Clear phone authentication session
 */
export function clearPhoneSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(PHONE_SESSION_KEY);
  }
}

/**
 * Check if user has a valid phone session
 */
export function hasPhoneSession(): boolean {
  return getPhoneSession() !== null;
}
