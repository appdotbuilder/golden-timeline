import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type UpdateUserCreditsInput } from '../schema';
import { updateUserCredits } from '../handlers/update_user_credits';
import { eq } from 'drizzle-orm';

describe('updateUserCredits', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Create test users helper
  const createTestUsers = async () => {
    // Create admin user
    const adminResult = await db.insert(usersTable)
      .values({
        email: 'admin@example.com',
        password_hash: 'hashed_admin_password',
        credits: 100,
        is_admin: true
      })
      .returning()
      .execute();

    // Create regular user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'user@example.com',
        password_hash: 'hashed_user_password',
        credits: 50,
        is_admin: false
      })
      .returning()
      .execute();

    // Create another regular user (non-admin)
    const nonAdminResult = await db.insert(usersTable)
      .values({
        email: 'nonadmin@example.com',
        password_hash: 'hashed_nonadmin_password',
        credits: 25,
        is_admin: false
      })
      .returning()
      .execute();

    return {
      admin: adminResult[0],
      user: userResult[0],
      nonAdmin: nonAdminResult[0]
    };
  };

  it('should update user credits successfully by admin', async () => {
    const { admin, user } = await createTestUsers();

    const input: UpdateUserCreditsInput = {
      user_id: user.id,
      credits: 75,
      admin_user_id: admin.id
    };

    const result = await updateUserCredits(input);

    // Verify return value
    expect(result.id).toEqual(user.id);
    expect(result.email).toEqual(user.email);
    expect(result.credits).toEqual(75);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify database was updated
    const updatedUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .execute();

    expect(updatedUsers).toHaveLength(1);
    expect(updatedUsers[0].credits).toEqual(75);
    expect(updatedUsers[0].updated_at).toBeInstanceOf(Date);
  });

  it('should update credits to zero', async () => {
    const { admin, user } = await createTestUsers();

    const input: UpdateUserCreditsInput = {
      user_id: user.id,
      credits: 0,
      admin_user_id: admin.id
    };

    const result = await updateUserCredits(input);

    expect(result.credits).toEqual(0);

    // Verify in database
    const updatedUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .execute();

    expect(updatedUsers[0].credits).toEqual(0);
  });

  it('should update credits to large number', async () => {
    const { admin, user } = await createTestUsers();

    const input: UpdateUserCreditsInput = {
      user_id: user.id,
      credits: 10000,
      admin_user_id: admin.id
    };

    const result = await updateUserCredits(input);

    expect(result.credits).toEqual(10000);

    // Verify in database
    const updatedUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .execute();

    expect(updatedUsers[0].credits).toEqual(10000);
  });

  it('should throw error when admin user does not exist', async () => {
    const { user } = await createTestUsers();

    const input: UpdateUserCreditsInput = {
      user_id: user.id,
      credits: 75,
      admin_user_id: 999 // Non-existent admin ID
    };

    await expect(updateUserCredits(input)).rejects.toThrow(/admin user not found/i);
  });

  it('should throw error when admin user is not admin', async () => {
    const { user, nonAdmin } = await createTestUsers();

    const input: UpdateUserCreditsInput = {
      user_id: user.id,
      credits: 75,
      admin_user_id: nonAdmin.id // Regular user, not admin
    };

    await expect(updateUserCredits(input)).rejects.toThrow(/does not have admin privileges/i);
  });

  it('should throw error when target user does not exist', async () => {
    const { admin } = await createTestUsers();

    const input: UpdateUserCreditsInput = {
      user_id: 999, // Non-existent user ID
      credits: 75,
      admin_user_id: admin.id
    };

    await expect(updateUserCredits(input)).rejects.toThrow(/target user not found/i);
  });

  it('should allow admin to update their own credits', async () => {
    const { admin } = await createTestUsers();

    const input: UpdateUserCreditsInput = {
      user_id: admin.id, // Admin updating themselves
      credits: 150,
      admin_user_id: admin.id
    };

    const result = await updateUserCredits(input);

    expect(result.id).toEqual(admin.id);
    expect(result.credits).toEqual(150);

    // Verify in database
    const updatedUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, admin.id))
      .execute();

    expect(updatedUsers[0].credits).toEqual(150);
  });

  it('should preserve all other user fields when updating credits', async () => {
    const { admin, user } = await createTestUsers();

    const input: UpdateUserCreditsInput = {
      user_id: user.id,
      credits: 99,
      admin_user_id: admin.id
    };

    const result = await updateUserCredits(input);

    // All original fields should be preserved
    expect(result.id).toEqual(user.id);
    expect(result.email).toEqual(user.email);
    expect(result.password_hash).toEqual(user.password_hash);
    expect(result.is_admin).toEqual(user.is_admin);
    expect(result.created_at).toEqual(user.created_at);
    expect(result.credits).toEqual(99); // Only this should change
    
    // updated_at should be newer
    expect(result.updated_at.getTime()).toBeGreaterThan(user.updated_at.getTime());
  });
});