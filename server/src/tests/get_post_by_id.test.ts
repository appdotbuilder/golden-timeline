import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, postsTable } from '../db/schema';
import { getPostById } from '../handlers/get_post_by_id';

describe('getPostById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return post by valid ID when post is not expired', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        credits: 10,
        is_admin: false
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test post that expires in the future
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // Expires in 7 days

    const postResult = await db.insert(postsTable)
      .values({
        user_id: userId,
        title: 'Test Post',
        description: 'A test post description',
        image_url: 'https://example.com/image.jpg',
        category: 'travel',
        country: 'USA',
        city: 'New York',
        credits_cost: 5,
        expires_at: futureDate
      })
      .returning()
      .execute();

    const postId = postResult[0].id;

    // Test the handler
    const result = await getPostById(postId);

    // Verify result
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(postId);
    expect(result!.user_id).toEqual(userId);
    expect(result!.title).toEqual('Test Post');
    expect(result!.description).toEqual('A test post description');
    expect(result!.image_url).toEqual('https://example.com/image.jpg');
    expect(result!.category).toEqual('travel');
    expect(result!.country).toEqual('USA');
    expect(result!.city).toEqual('New York');
    expect(result!.credits_cost).toEqual(5);
    expect(result!.expires_at).toBeInstanceOf(Date);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null for non-existent post ID', async () => {
    const nonExistentId = 99999;

    const result = await getPostById(nonExistentId);

    expect(result).toBeNull();
  });

  it('should return null for expired post', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        credits: 10,
        is_admin: false
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test post that expired in the past
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1); // Expired yesterday

    const postResult = await db.insert(postsTable)
      .values({
        user_id: userId,
        title: 'Expired Post',
        description: 'This post has expired',
        image_url: 'https://example.com/expired.jpg',
        category: 'food',
        country: 'France',
        city: 'Paris',
        credits_cost: 3,
        expires_at: pastDate
      })
      .returning()
      .execute();

    const postId = postResult[0].id;

    // Test the handler
    const result = await getPostById(postId);

    // Should return null because post is expired
    expect(result).toBeNull();
  });

  it('should return null for post expiring exactly now', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        credits: 10,
        is_admin: false
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test post that expires right now (or very close to now)
    const now = new Date();

    const postResult = await db.insert(postsTable)
      .values({
        user_id: userId,
        title: 'Just Expired Post',
        description: 'This post expires right now',
        image_url: 'https://example.com/justnow.jpg',
        category: 'lifestyle',
        country: 'Japan',
        city: 'Tokyo',
        credits_cost: 2,
        expires_at: now
      })
      .returning()
      .execute();

    const postId = postResult[0].id;

    // Wait a tiny bit to ensure the post has expired
    await new Promise(resolve => setTimeout(resolve, 10));

    // Test the handler
    const result = await getPostById(postId);

    // Should return null because post has expired
    expect(result).toBeNull();
  });

  it('should handle posts with different categories correctly', async () => {
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        credits: 10,
        is_admin: false
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test post with 'technology' category
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    const postResult = await db.insert(postsTable)
      .values({
        user_id: userId,
        title: 'Tech Post',
        description: 'A technology post',
        image_url: 'https://example.com/tech.jpg',
        category: 'technology',
        country: 'Germany',
        city: 'Berlin',
        credits_cost: 8,
        expires_at: futureDate
      })
      .returning()
      .execute();

    const postId = postResult[0].id;

    // Test the handler
    const result = await getPostById(postId);

    // Verify category is correctly returned
    expect(result).not.toBeNull();
    expect(result!.category).toEqual('technology');
    expect(result!.title).toEqual('Tech Post');
  });
});