import { db } from '../db';
import { postsTable } from '../db/schema';
import { type GetUserPostsInput, type Post } from '../schema';
import { eq, gt, desc, and } from 'drizzle-orm';

export const getUserPosts = async (input: GetUserPostsInput): Promise<Post[]> => {
  try {
    // Build conditions array
    const conditions = [eq(postsTable.user_id, input.user_id)];

    // Filter out expired posts if include_expired is false (default behavior)
    if (!input.include_expired) {
      conditions.push(gt(postsTable.expires_at, new Date()));
    }

    // Build and execute query in one chain
    const results = await db.select()
      .from(postsTable)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(postsTable.created_at))
      .execute();

    // Return results - no numeric conversions needed as all fields are already proper types
    return results;
  } catch (error) {
    console.error('Failed to get user posts:', error);
    throw error;
  }
};