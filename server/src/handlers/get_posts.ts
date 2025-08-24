import { db } from '../db';
import { postsTable } from '../db/schema';
import { type GetPostsInput, type Post } from '../schema';
import { and, eq, gt, desc } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export const getPosts = async (input: GetPostsInput): Promise<Post[]> => {
  try {
    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    // Only include non-expired posts
    conditions.push(gt(postsTable.expires_at, new Date()));

    // Apply optional filters
    if (input.category) {
      conditions.push(eq(postsTable.category, input.category));
    }

    if (input.country) {
      conditions.push(eq(postsTable.country, input.country));
    }

    if (input.city) {
      conditions.push(eq(postsTable.city, input.city));
    }

    // Execute query with all conditions in a single chain
    const results = await db.select()
      .from(postsTable)
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(postsTable.created_at))
      .limit(input.limit)
      .offset(input.offset)
      .execute();

    // Convert numeric fields back to numbers and return
    return results.map(post => ({
      ...post,
      credits_cost: post.credits_cost // Integer column - no conversion needed
    }));
  } catch (error) {
    console.error('Get posts failed:', error);
    throw error;
  }
};