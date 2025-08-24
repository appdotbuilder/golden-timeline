import { db } from '../db';
import { postsTable } from '../db/schema';
import { lt } from 'drizzle-orm';

export const cleanupExpiredPosts = async (): Promise<number> => {
  try {
    // Delete all posts where expires_at is less than current time
    const result = await db.delete(postsTable)
      .where(lt(postsTable.expires_at, new Date()))
      .returning({ id: postsTable.id })
      .execute();

    // Return count of deleted posts
    return result.length;
  } catch (error) {
    console.error('Cleanup expired posts failed:', error);
    throw error;
  }
};