import { db } from '../db';
import { postsTable, usersTable } from '../db/schema';
import { type CreatePostInput, type Post } from '../schema';
import { eq } from 'drizzle-orm';

export const createPost = async (input: CreatePostInput): Promise<Post> => {
  try {
    // 1. Verify user exists and has sufficient credits
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    if (user[0].credits < input.credits_cost) {
      throw new Error('Insufficient credits');
    }

    // 2. Deduct credits from user account
    await db.update(usersTable)
      .set({ 
        credits: user[0].credits - input.credits_cost,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, input.user_id))
      .execute();

    // 3. Create new post with expiry time set to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // 4. Save post to database
    const result = await db.insert(postsTable)
      .values({
        user_id: input.user_id,
        title: input.title,
        description: input.description,
        image_url: input.image_url,
        category: input.category,
        country: input.country,
        city: input.city,
        credits_cost: input.credits_cost,
        expires_at: expiresAt
      })
      .returning()
      .execute();

    // 5. Return created post data
    return result[0];
  } catch (error) {
    console.error('Post creation failed:', error);
    throw error;
  }
};