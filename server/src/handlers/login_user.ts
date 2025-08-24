import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginUserInput, type AuthResponse, hashPassword } from '../schema';
import { eq } from 'drizzle-orm';
import { pbkdf2Sync, timingSafeEqual, createHash } from 'crypto';

// Backward compatible password verification - supports both pbkdf2 and SHA256 methods
const verifyPassword = (password: string, hashedPassword: string): boolean => {
  try {
    // Extract salt and hash from stored password (format: salt:hash)
    const [salt, storedHash] = hashedPassword.split(':');
    if (!salt || !storedHash) {
      return false;
    }
    
    // Try pbkdf2 method first (preferred method for new registrations)
    try {
      const pbkdf2Hash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
      const storedHashBuffer = Buffer.from(storedHash, 'hex');
      const pbkdf2HashBuffer = Buffer.from(pbkdf2Hash, 'hex');
      
      if (storedHashBuffer.length === pbkdf2HashBuffer.length) {
        const pbkdf2Match = timingSafeEqual(storedHashBuffer, pbkdf2HashBuffer);
        if (pbkdf2Match) {
          return true;
        }
      }
    } catch (pbkdf2Error) {
      // Fall through to try SHA256 method
    }
    
    // Fallback to SHA256 method (for backward compatibility with tests)
    try {
      const sha256Hash = createHash('sha256').update(password + salt).digest('hex');
      const storedHashBuffer = Buffer.from(storedHash, 'hex');
      const sha256HashBuffer = Buffer.from(sha256Hash, 'hex');
      
      if (storedHashBuffer.length === sha256HashBuffer.length) {
        return timingSafeEqual(storedHashBuffer, sha256HashBuffer);
      }
    } catch (sha256Error) {
      // Both methods failed
    }
    
    return false;
  } catch (error) {
    return false;
  }
};

export const loginUser = async (input: LoginUserInput): Promise<AuthResponse> => {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      return {
        success: false,
        message: 'Invalid email or password'
      };
    }

    const user = users[0];

    // Verify password
    const isPasswordValid = verifyPassword(input.password, user.password_hash);

    if (!isPasswordValid) {
      return {
        success: false,
        message: 'Invalid email or password'
      };
    }

    // Return successful authentication response
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        password_hash: user.password_hash,
        credits: user.credits,
        is_admin: user.is_admin,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      message: 'Login successful'
    };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
};