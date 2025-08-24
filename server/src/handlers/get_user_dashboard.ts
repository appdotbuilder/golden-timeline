import { db } from '../db';
import { usersTable, postsTable } from '../db/schema';
import { type UserDashboard } from '../schema';
import { eq, desc, lt, gte, sum, and } from 'drizzle-orm';

export const getUserDashboard = async (userId: number): Promise<UserDashboard> => {
  try {
    // 1. Fetch user data by ID
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (users.length === 0) {
      throw new Error(`User with ID ${userId} not found`);
    }

    const user = users[0];
    const now = new Date();

    // 2. Count active posts (not expired)
    const activePostsResult = await db.select()
      .from(postsTable)
      .where(and(
        eq(postsTable.user_id, userId),
        gte(postsTable.expires_at, now)
      ))
      .execute();

    const active_posts_count = activePostsResult.length;

    // 3. Count expired posts
    const expiredPostsResult = await db.select()
      .from(postsTable)
      .where(and(
        eq(postsTable.user_id, userId),
        lt(postsTable.expires_at, now)
      ))
      .execute();

    const expired_posts_count = expiredPostsResult.length;

    // 4. Calculate total credits spent on posts
    const creditsResult = await db.select({
      total: sum(postsTable.credits_cost)
    })
      .from(postsTable)
      .where(eq(postsTable.user_id, userId))
      .execute();

    const total_credits_spent = parseInt(creditsResult[0]?.total || '0');

    // 5. Fetch recent posts (last 10 posts)
    const recent_posts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.user_id, userId))
      .orderBy(desc(postsTable.created_at))
      .limit(10)
      .execute();

    // 6. Return comprehensive dashboard data
    return {
      user,
      active_posts_count,
      expired_posts_count,
      total_credits_spent,
      recent_posts
    };
  } catch (error) {
    console.error('Failed to fetch user dashboard:', error);
    throw error;
  }
};