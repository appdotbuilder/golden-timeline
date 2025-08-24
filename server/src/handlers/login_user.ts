import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginUserInput, type AuthResponse } from '../schema';
import { eq } from 'drizzle-orm';
import { createHash, timingSafeEqual } from 'crypto';

// Simple password verification using crypto module
const verifyPassword = (password: string, hashedPassword: string): boolean => {
  try {
    // Extract salt and hash from stored password (format: salt:hash)
    const [salt, storedHash] = hashedPassword.split(':');
    if (!salt || !storedHash) {
      return false;
    }
    
    // Hash the provided password with the same salt
    const hash = createHash('sha256').update(password + salt).digest('hex');
    
    // Use timing-safe comparison to prevent timing attacks
    const storedHashBuffer = Buffer.from(storedHash, 'hex');
    const hashBuffer = Buffer.from(hash, 'hex');
    
    if (storedHashBuffer.length !== hashBuffer.length) {
      return false;
    }
    
    return timingSafeEqual(storedHashBuffer, hashBuffer);
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