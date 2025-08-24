import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { pbkdf2Sync } from 'crypto';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegisterUserInput } from '../schema';
import { registerUser } from '../handlers/register_user';
import { eq } from 'drizzle-orm';

// Helper function to verify password hash
const verifyPassword = (password: string, hashedPassword: string): boolean => {
  const [salt, hash] = hashedPassword.split(':');
  const verifyHash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
};

// Test input data
const validInput: RegisterUserInput = {
  email: 'test@example.com',
  password: 'password123'
};

describe('registerUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should register a new user successfully', async () => {
    const result = await registerUser(validInput);

    // Verify response structure
    expect(result.success).toBe(true);
    expect(result.message).toBe('User registered successfully');
    expect(result.user).toBeDefined();
    
    // Verify user data
    expect(result.user!.email).toBe('test@example.com');
    expect(result.user!.credits).toBe(10);
    expect(result.user!.is_admin).toBe(false);
    expect(result.user!.id).toBeDefined();
    expect(result.user!.created_at).toBeInstanceOf(Date);
    expect(result.user!.updated_at).toBeInstanceOf(Date);
    expect(result.user!.password_hash).toBeDefined();
  });

  it('should hash the password correctly', async () => {
    const result = await registerUser(validInput);

    // Verify password is hashed (not plain text)
    expect(result.user!.password_hash).not.toBe('password123');
    expect(result.user!.password_hash.length).toBeGreaterThan(20);
    expect(result.user!.password_hash).toContain(':'); // Should contain salt separator

    // Verify password can be verified with our hash function
    const isValidPassword = verifyPassword('password123', result.user!.password_hash);
    expect(isValidPassword).toBe(true);

    // Verify wrong password fails
    const isInvalidPassword = verifyPassword('wrongpassword', result.user!.password_hash);
    expect(isInvalidPassword).toBe(false);
  });

  it('should save user to database correctly', async () => {
    const result = await registerUser(validInput);

    // Query database directly to verify user was saved
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.user!.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].email).toBe('test@example.com');
    expect(users[0].credits).toBe(10);
    expect(users[0].is_admin).toBe(false);
    expect(users[0].created_at).toBeInstanceOf(Date);
    expect(users[0].updated_at).toBeInstanceOf(Date);
  });

  it('should reject duplicate email addresses', async () => {
    // Register first user
    await registerUser(validInput);

    // Try to register with same email
    const duplicateInput: RegisterUserInput = {
      email: 'test@example.com',
      password: 'differentpassword'
    };

    const result = await registerUser(duplicateInput);

    // Verify rejection
    expect(result.success).toBe(false);
    expect(result.message).toBe('Email already exists');
    expect(result.user).toBeUndefined();

    // Verify only one user exists in database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, 'test@example.com'))
      .execute();

    expect(users).toHaveLength(1);
  });

  it('should handle different valid email formats', async () => {
    const testEmails = [
      'user@domain.com',
      'user.name@domain.co.uk',
      'user+tag@subdomain.domain.org'
    ];

    for (const email of testEmails) {
      const input: RegisterUserInput = {
        email: email,
        password: 'password123'
      };

      const result = await registerUser(input);

      expect(result.success).toBe(true);
      expect(result.user!.email).toBe(email);
    }

    // Verify all users were created
    const allUsers = await db.select()
      .from(usersTable)
      .execute();

    expect(allUsers).toHaveLength(3);
  });

  it('should set default values correctly', async () => {
    const result = await registerUser(validInput);

    // Verify default values are set
    expect(result.user!.credits).toBe(10);
    expect(result.user!.is_admin).toBe(false);
    expect(result.user!.created_at).toBeInstanceOf(Date);
    expect(result.user!.updated_at).toBeInstanceOf(Date);

    // Verify timestamps are recent (within last minute)
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    
    expect(result.user!.created_at >= oneMinuteAgo).toBe(true);
    expect(result.user!.updated_at >= oneMinuteAgo).toBe(true);
  });

  it('should handle minimum length passwords', async () => {
    const minPasswordInput: RegisterUserInput = {
      email: 'minpass@example.com',
      password: '123456' // Exactly 6 characters (minimum)
    };

    const result = await registerUser(minPasswordInput);

    expect(result.success).toBe(true);
    expect(result.user!.email).toBe('minpass@example.com');

    // Verify password was hashed correctly
    const isValid = verifyPassword('123456', result.user!.password_hash);
    expect(isValid).toBe(true);
  });
});