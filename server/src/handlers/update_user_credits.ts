import { db } from '../db';
import { usersTable } from '../db/schema';
import { type UpdateUserCreditsInput, type User } from '../schema';
import { eq } from 'drizzle-orm';

export const updateUserCredits = async (input: UpdateUserCreditsInput): Promise<User> => {
  try {
    // 1. Verify that admin_user_id has admin privileges
    const adminUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.admin_user_id))
      .execute();

    if (adminUsers.length === 0) {
      throw new Error('Admin user not found');
    }

    const adminUser = adminUsers[0];
    if (!adminUser.is_admin) {
      throw new Error('User does not have admin privileges');
    }

    // 2. Find target user by user_id
    const targetUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (targetUsers.length === 0) {
      throw new Error('Target user not found');
    }

    const currentUser = targetUsers[0];

    // 3. Update user's credits to the new amount
    const result = await db.update(usersTable)
      .set({
        credits: input.credits,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, input.user_id))
      .returning()
      .execute();

    // 4. Log the credit change for audit purposes
    console.log(`Admin ${input.admin_user_id} updated credits for user ${input.user_id}: ${currentUser.credits} -> ${input.credits}`);

    // 5. Return updated user data
    return result[0];
  } catch (error) {
    console.error('Update user credits failed:', error);
    throw error;
  }
};