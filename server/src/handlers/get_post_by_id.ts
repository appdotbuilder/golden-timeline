import { db } from '../db';
import { postsTable } from '../db/schema';
import { type Post } from '../schema';
import { eq, gt } from 'drizzle-orm';

export const getPostById = async (postId: number): Promise<Post | null> => {
  try {
    // Query post by ID and check if it hasn't expired
    const result = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, postId))
      .execute();

    if (result.length === 0) {
      return null;
    }

    const post = result[0];

    // Check if post has expired
    const now = new Date();
    if (post.expires_at <= now) {
      return null;
    }

    // Return the post with proper type structure
    return {
      id: post.id,
      user_id: post.user_id,
      title: post.title,
      description: post.description,
      image_url: post.image_url,
      category: post.category,
      country: post.country,
      city: post.city,
      credits_cost: post.credits_cost,
      expires_at: post.expires_at,
      created_at: post.created_at,
      updated_at: post.updated_at
    };
  } catch (error) {
    console.error('Get post by ID failed:', error);
    throw error;
  }
};