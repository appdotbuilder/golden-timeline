import { createHash, randomBytes, pbkdf2Sync } from 'crypto';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type RegisterUserInput, type AuthResponse } from '../schema';

export const registerUser = async (input: RegisterUserInput): Promise<AuthResponse> => {
  try {
    // Check if email already exists
    const existingUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (existingUsers.length > 0) {
      return {
        success: false,
        message: 'Email already exists'
      };
    }

    // Hash the password using pbkdf2
    const salt = randomBytes(32).toString('hex');
    const hash = pbkdf2Sync(input.password, salt, 10000, 64, 'sha512').toString('hex');
    const password_hash = `${salt}:${hash}`;

    // Create new user with default 10 credits
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        password_hash: password_hash,
        credits: 10, // Default credits for new users
        is_admin: false
      })
      .returning()
      .execute();

    const user = result[0];
    
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        password_hash: user.password_hash,
        credits: user.credits,
        is_admin: user.is_admin,
        created_at: user.created_at!,
        updated_at: user.updated_at!
      },
      message: 'User registered successfully'
    };
  } catch (error) {
    console.error('User registration failed:', error);
    throw error;
  }
};