import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, postsTable } from '../db/schema';
import { type GetUserPostsInput } from '../schema';
import { getUserPosts } from '../handlers/get_user_posts';

// Test data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashed_password',
  credits: 50,
  is_admin: false
};

const testUser2 = {
  email: 'test2@example.com',
  password_hash: 'hashed_password2',
  credits: 30,
  is_admin: false
};

describe('getUserPosts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array for user with no posts', async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    const input: GetUserPostsInput = {
      user_id: userId,
      include_expired: false
    };

    const result = await getUserPosts(input);
    expect(result).toEqual([]);
  });

  it('should return active posts only when include_expired is false', async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create active post (expires in future)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    // Create expired post
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    const activePost = {
      user_id: userId,
      title: 'Active Post',
      description: 'This post is still active',
      image_url: 'https://example.com/image1.jpg',
      category: 'travel' as const,
      country: 'USA',
      city: 'New York',
      credits_cost: 5,
      expires_at: futureDate
    };

    const expiredPost = {
      user_id: userId,
      title: 'Expired Post',
      description: 'This post has expired',
      image_url: 'https://example.com/image2.jpg',
      category: 'food' as const,
      country: 'USA',
      city: 'Los Angeles',
      credits_cost: 3,
      expires_at: pastDate
    };

    await db.insert(postsTable).values([activePost, expiredPost]).execute();

    const input: GetUserPostsInput = {
      user_id: userId,
      include_expired: false
    };

    const result = await getUserPosts(input);
    
    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('Active Post');
    expect(result[0].category).toEqual('travel');
    expect(result[0].expires_at).toEqual(futureDate);
  });

  it('should return all posts when include_expired is true', async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create active post (expires in future)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    // Create expired post
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    const activePost = {
      user_id: userId,
      title: 'Active Post',
      description: 'This post is still active',
      image_url: 'https://example.com/image1.jpg',
      category: 'travel' as const,
      country: 'USA',
      city: 'New York',
      credits_cost: 5,
      expires_at: futureDate
    };

    const expiredPost = {
      user_id: userId,
      title: 'Expired Post',
      description: 'This post has expired',
      image_url: 'https://example.com/image2.jpg',
      category: 'food' as const,
      country: 'USA',
      city: 'Los Angeles',
      credits_cost: 3,
      expires_at: pastDate
    };

    await db.insert(postsTable).values([activePost, expiredPost]).execute();

    const input: GetUserPostsInput = {
      user_id: userId,
      include_expired: true
    };

    const result = await getUserPosts(input);
    
    expect(result).toHaveLength(2);
    // Should include both posts
    const titles = result.map(post => post.title);
    expect(titles).toContain('Active Post');
    expect(titles).toContain('Expired Post');
  });

  it('should return posts ordered by created_at descending (newest first)', async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    // Create multiple posts with small time delays to ensure different timestamps
    const post1 = {
      user_id: userId,
      title: 'First Post',
      description: 'Created first',
      image_url: 'https://example.com/image1.jpg',
      category: 'travel' as const,
      country: 'USA',
      city: 'New York',
      credits_cost: 5,
      expires_at: futureDate
    };

    await db.insert(postsTable).values(post1).execute();
    
    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const post2 = {
      user_id: userId,
      title: 'Second Post',
      description: 'Created second',
      image_url: 'https://example.com/image2.jpg',
      category: 'food' as const,
      country: 'USA',
      city: 'Los Angeles',
      credits_cost: 3,
      expires_at: futureDate
    };

    await db.insert(postsTable).values(post2).execute();

    const input: GetUserPostsInput = {
      user_id: userId,
      include_expired: false
    };

    const result = await getUserPosts(input);
    
    expect(result).toHaveLength(2);
    // Should be ordered newest first
    expect(result[0].title).toEqual('Second Post');
    expect(result[1].title).toEqual('First Post');
    expect(result[0].created_at >= result[1].created_at).toBe(true);
  });

  it('should only return posts for specified user', async () => {
    // Create two users
    const user1Result = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId1 = user1Result[0].id;

    const user2Result = await db.insert(usersTable)
      .values(testUser2)
      .returning()
      .execute();
    const userId2 = user2Result[0].id;

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    // Create posts for both users
    const user1Post = {
      user_id: userId1,
      title: 'User 1 Post',
      description: 'Post by first user',
      image_url: 'https://example.com/image1.jpg',
      category: 'travel' as const,
      country: 'USA',
      city: 'New York',
      credits_cost: 5,
      expires_at: futureDate
    };

    const user2Post = {
      user_id: userId2,
      title: 'User 2 Post',
      description: 'Post by second user',
      image_url: 'https://example.com/image2.jpg',
      category: 'food' as const,
      country: 'USA',
      city: 'Los Angeles',
      credits_cost: 3,
      expires_at: futureDate
    };

    await db.insert(postsTable).values([user1Post, user2Post]).execute();

    const input: GetUserPostsInput = {
      user_id: userId1,
      include_expired: false
    };

    const result = await getUserPosts(input);
    
    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('User 1 Post');
    expect(result[0].user_id).toEqual(userId1);
  });

  it('should exclude expired posts when include_expired is false', async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create expired post
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    const expiredPost = {
      user_id: userId,
      title: 'Expired Post',
      description: 'This post has expired',
      image_url: 'https://example.com/image.jpg',
      category: 'travel' as const,
      country: 'USA',
      city: 'New York',
      credits_cost: 5,
      expires_at: pastDate
    };

    await db.insert(postsTable).values(expiredPost).execute();

    // Test with include_expired explicitly false
    const input: GetUserPostsInput = {
      user_id: userId,
      include_expired: false
    };

    const result = await getUserPosts(input);
    
    // Should not include expired posts when include_expired is false
    expect(result).toHaveLength(0);
  });

  it('should return all required post fields', async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    const userId = userResult[0].id;

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    const testPost = {
      user_id: userId,
      title: 'Test Post',
      description: 'Test description',
      image_url: 'https://example.com/image.jpg',
      category: 'technology' as const,
      country: 'Canada',
      city: 'Toronto',
      credits_cost: 10,
      expires_at: futureDate
    };

    await db.insert(postsTable).values(testPost).execute();

    const input: GetUserPostsInput = {
      user_id: userId,
      include_expired: false
    };

    const result = await getUserPosts(input);
    
    expect(result).toHaveLength(1);
    const post = result[0];
    
    // Verify all fields are present and correct
    expect(post.id).toBeDefined();
    expect(post.user_id).toEqual(userId);
    expect(post.title).toEqual('Test Post');
    expect(post.description).toEqual('Test description');
    expect(post.image_url).toEqual('https://example.com/image.jpg');
    expect(post.category).toEqual('technology');
    expect(post.country).toEqual('Canada');
    expect(post.city).toEqual('Toronto');
    expect(post.credits_cost).toEqual(10);
    expect(post.expires_at).toEqual(futureDate);
    expect(post.created_at).toBeInstanceOf(Date);
    expect(post.updated_at).toBeInstanceOf(Date);
  });
});