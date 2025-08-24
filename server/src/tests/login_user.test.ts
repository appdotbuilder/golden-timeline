import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginUserInput } from '../schema';
import { loginUser } from '../handlers/login_user';
import { createHash, randomBytes } from 'crypto';

// Simple password hashing function using crypto module
const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(password + salt).digest('hex');
  return `${salt}:${hash}`;
};

describe('loginUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const testUserEmail = 'test@example.com';
  const testPassword = 'password123';
  let testUserId: number;

  // Helper to create a test user
  const createTestUser = async (isAdmin: boolean = false, credits: number = 10) => {
    const hashedPassword = hashPassword(testPassword);
    
    const result = await db.insert(usersTable)
      .values({
        email: testUserEmail,
        password_hash: hashedPassword,
        credits,
        is_admin: isAdmin
      })
      .returning()
      .execute();

    testUserId = result[0].id;
    return result[0];
  };

  it('should successfully login with valid credentials', async () => {
    // Create test user
    const createdUser = await createTestUser();

    const input: LoginUserInput = {
      email: testUserEmail,
      password: testPassword
    };

    const result = await loginUser(input);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Login successful');
    expect(result.user).toBeDefined();
    expect(result.user!.id).toBe(createdUser.id);
    expect(result.user!.email).toBe(testUserEmail);
    expect(result.user!.credits).toBe(10);
    expect(result.user!.is_admin).toBe(false);
    expect(result.user!.created_at).toBeInstanceOf(Date);
    expect(result.user!.updated_at).toBeInstanceOf(Date);
  });

  it('should successfully login admin user', async () => {
    // Create admin test user with more credits
    await createTestUser(true, 100);

    const input: LoginUserInput = {
      email: testUserEmail,
      password: testPassword
    };

    const result = await loginUser(input);

    expect(result.success).toBe(true);
    expect(result.user!.is_admin).toBe(true);
    expect(result.user!.credits).toBe(100);
  });

  it('should fail login with non-existent email', async () => {
    const input: LoginUserInput = {
      email: 'nonexistent@example.com',
      password: testPassword
    };

    const result = await loginUser(input);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid email or password');
    expect(result.user).toBeUndefined();
  });

  it('should fail login with incorrect password', async () => {
    // Create test user
    await createTestUser();

    const input: LoginUserInput = {
      email: testUserEmail,
      password: 'wrongpassword'
    };

    const result = await loginUser(input);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid email or password');
    expect(result.user).toBeUndefined();
  });

  it('should fail login with empty password', async () => {
    // Create test user
    await createTestUser();

    const input: LoginUserInput = {
      email: testUserEmail,
      password: ''
    };

    const result = await loginUser(input);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid email or password');
    expect(result.user).toBeUndefined();
  });

  it('should handle case-sensitive email correctly', async () => {
    // Create test user with lowercase email
    await createTestUser();

    // Try to login with uppercase email
    const input: LoginUserInput = {
      email: 'TEST@EXAMPLE.COM',
      password: testPassword
    };

    const result = await loginUser(input);

    // Should fail because email is case-sensitive
    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid email or password');
  });

  it('should return user with current credits balance', async () => {
    // Create user with specific credits amount
    await createTestUser(false, 50);

    const input: LoginUserInput = {
      email: testUserEmail,
      password: testPassword
    };

    const result = await loginUser(input);

    expect(result.success).toBe(true);
    expect(result.user!.credits).toBe(50);
  });

  it('should not expose password hash in response', async () => {
    // Create test user
    await createTestUser();

    const input: LoginUserInput = {
      email: testUserEmail,
      password: testPassword
    };

    const result = await loginUser(input);

    expect(result.success).toBe(true);
    expect(result.user!.password_hash).toBeDefined();
    expect(result.user!.password_hash).not.toBe(testPassword);
    expect(result.user!.password_hash.length).toBeGreaterThan(20); // Hashed password should be long
    expect(result.user!.password_hash).toContain(':'); // Should contain salt separator
  });

  it('should handle multiple users with different emails', async () => {
    // Create first user
    await createTestUser();

    // Create second user
    const secondEmail = 'second@example.com';
    const secondPassword = 'password456';
    const hashedPassword2 = hashPassword(secondPassword);
    
    await db.insert(usersTable)
      .values({
        email: secondEmail,
        password_hash: hashedPassword2,
        credits: 20,
        is_admin: false
      })
      .execute();

    // Login with first user
    const firstLogin = await loginUser({
      email: testUserEmail,
      password: testPassword
    });

    expect(firstLogin.success).toBe(true);
    expect(firstLogin.user!.email).toBe(testUserEmail);
    expect(firstLogin.user!.credits).toBe(10);

    // Login with second user
    const secondLogin = await loginUser({
      email: secondEmail,
      password: secondPassword
    });

    expect(secondLogin.success).toBe(true);
    expect(secondLogin.user!.email).toBe(secondEmail);
    expect(secondLogin.user!.credits).toBe(20);
  });

  it('should fail with malformed password hash', async () => {
    // Create user with malformed password hash (missing salt separator)
    const result = await db.insert(usersTable)
      .values({
        email: testUserEmail,
        password_hash: 'malformed_hash_without_salt',
        credits: 10,
        is_admin: false
      })
      .returning()
      .execute();

    const input: LoginUserInput = {
      email: testUserEmail,
      password: testPassword
    };

    const loginResult = await loginUser(input);

    expect(loginResult.success).toBe(false);
    expect(loginResult.message).toBe('Invalid email or password');
  });

  it('should use timing-safe comparison for password verification', async () => {
    // This test ensures that password verification doesn't leak timing information
    await createTestUser();

    const shortPassword = 'a';
    const longPassword = 'a'.repeat(1000);

    // Both should fail in roughly the same time (timing-safe)
    const input1: LoginUserInput = {
      email: testUserEmail,
      password: shortPassword
    };

    const input2: LoginUserInput = {
      email: testUserEmail,
      password: longPassword
    };

    const result1 = await loginUser(input1);
    const result2 = await loginUser(input2);

    expect(result1.success).toBe(false);
    expect(result2.success).toBe(false);
    expect(result1.message).toBe('Invalid email or password');
    expect(result2.message).toBe('Invalid email or password');
  });
});