import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, postsTable } from '../db/schema';
import { type CreatePostInput } from '../schema';
import { createPost } from '../handlers/create_post';
import { eq } from 'drizzle-orm';

describe('createPost', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Create a test user with sufficient credits
  const setupTestUser = async (credits = 50) => {
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        credits,
        is_admin: false
      })
      .returning()
      .execute();
    
    return userResult[0];
  };

  const testPostInput: CreatePostInput = {
    user_id: 1, // Will be set dynamically in tests
    title: 'Amazing Travel Experience',
    description: 'A wonderful journey through the mountains with breathtaking views and amazing local cuisine.',
    image_url: 'https://example.com/image.jpg',
    category: 'travel',
    country: 'Switzerland',
    city: 'Zermatt',
    credits_cost: 25
  };

  it('should create a post successfully', async () => {
    const user = await setupTestUser(50);
    const input = { ...testPostInput, user_id: user.id };

    const result = await createPost(input);

    // Verify post fields
    expect(result.user_id).toEqual(user.id);
    expect(result.title).toEqual('Amazing Travel Experience');
    expect(result.description).toEqual(testPostInput.description);
    expect(result.image_url).toEqual('https://example.com/image.jpg');
    expect(result.category).toEqual('travel');
    expect(result.country).toEqual('Switzerland');
    expect(result.city).toEqual('Zermatt');
    expect(result.credits_cost).toEqual(25);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify expiry date is approximately 24 hours from now
    const now = new Date();
    const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const timeDiff = Math.abs(result.expires_at.getTime() - twentyFourHoursLater.getTime());
    expect(timeDiff).toBeLessThan(60000); // Within 1 minute tolerance
  });

  it('should save post to database correctly', async () => {
    const user = await setupTestUser(50);
    const input = { ...testPostInput, user_id: user.id };

    const result = await createPost(input);

    // Verify post exists in database
    const posts = await db.select()
      .from(postsTable)
      .where(eq(postsTable.id, result.id))
      .execute();

    expect(posts).toHaveLength(1);
    expect(posts[0].title).toEqual('Amazing Travel Experience');
    expect(posts[0].user_id).toEqual(user.id);
    expect(posts[0].credits_cost).toEqual(25);
    expect(posts[0].category).toEqual('travel');
  });

  it('should deduct credits from user account', async () => {
    const user = await setupTestUser(50);
    const input = { ...testPostInput, user_id: user.id, credits_cost: 30 };

    await createPost(input);

    // Verify user credits were deducted
    const updatedUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .execute();

    expect(updatedUser[0].credits).toEqual(20); // 50 - 30 = 20
    expect(updatedUser[0].updated_at).toBeInstanceOf(Date);
  });

  it('should throw error when user does not exist', async () => {
    const input = { ...testPostInput, user_id: 999 };

    await expect(createPost(input)).rejects.toThrow(/user not found/i);
  });

  it('should throw error when user has insufficient credits', async () => {
    const user = await setupTestUser(10); // Only 10 credits
    const input = { ...testPostInput, user_id: user.id, credits_cost: 25 };

    await expect(createPost(input)).rejects.toThrow(/insufficient credits/i);

    // Verify user credits were not changed
    const unchangedUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .execute();

    expect(unchangedUser[0].credits).toEqual(10);
  });

  it('should handle exact credit amount correctly', async () => {
    const user = await setupTestUser(25); // Exactly enough credits
    const input = { ...testPostInput, user_id: user.id, credits_cost: 25 };

    const result = await createPost(input);

    expect(result.credits_cost).toEqual(25);

    // Verify user has 0 credits left
    const updatedUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .execute();

    expect(updatedUser[0].credits).toEqual(0);
  });

  it('should handle different post categories correctly', async () => {
    const user = await setupTestUser(100);
    const foodPostInput = {
      ...testPostInput,
      user_id: user.id,
      title: 'Best Local Restaurant',
      category: 'food' as const,
      credits_cost: 15
    };

    const result = await createPost(foodPostInput);

    expect(result.category).toEqual('food');
    expect(result.title).toEqual('Best Local Restaurant');
    expect(result.credits_cost).toEqual(15);
  });

  it('should create multiple posts for same user', async () => {
    const user = await setupTestUser(100);

    // Create first post
    const firstPost = await createPost({
      ...testPostInput,
      user_id: user.id,
      title: 'First Post',
      credits_cost: 20
    });

    // Create second post
    const secondPost = await createPost({
      ...testPostInput,
      user_id: user.id,
      title: 'Second Post',
      credits_cost: 30
    });

    expect(firstPost.id).not.toEqual(secondPost.id);
    expect(firstPost.title).toEqual('First Post');
    expect(secondPost.title).toEqual('Second Post');

    // Verify user credits were deducted correctly (100 - 20 - 30 = 50)
    const updatedUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .execute();

    expect(updatedUser[0].credits).toEqual(50);
  });
});