import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, postsTable } from '../db/schema';
import { getUserDashboard } from '../handlers/get_user_dashboard';

describe('getUserDashboard', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return dashboard data for user with no posts', async () => {
    // Create a test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'user@example.com',
        password_hash: 'hashed_password',
        credits: 25,
        is_admin: false
      })
      .returning()
      .execute();

    const user = userResult[0];
    const result = await getUserDashboard(user.id);

    // Verify user data
    expect(result.user.id).toEqual(user.id);
    expect(result.user.email).toEqual('user@example.com');
    expect(result.user.credits).toEqual(25);
    expect(result.user.is_admin).toEqual(false);
    expect(result.user.created_at).toBeInstanceOf(Date);

    // Verify counts with no posts
    expect(result.active_posts_count).toEqual(0);
    expect(result.expired_posts_count).toEqual(0);
    expect(result.total_credits_spent).toEqual(0);
    expect(result.recent_posts).toEqual([]);
  });

  it('should return dashboard data with active and expired posts', async () => {
    // Create a test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'user@example.com',
        password_hash: 'hashed_password',
        credits: 100,
        is_admin: false
      })
      .returning()
      .execute();

    const user = userResult[0];
    const now = new Date();
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
    const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday

    // Create posts one by one to ensure different timestamps
    await db.insert(postsTable)
      .values({
        user_id: user.id,
        title: 'Active Post 1',
        description: 'This post is still active',
        image_url: 'https://example.com/image1.jpg',
        category: 'travel',
        country: 'USA',
        city: 'New York',
        credits_cost: 10,
        expires_at: futureDate
      })
      .execute();

    await new Promise(resolve => setTimeout(resolve, 1));

    await db.insert(postsTable)
      .values({
        user_id: user.id,
        title: 'Active Post 2',
        description: 'This post is also active',
        image_url: 'https://example.com/image2.jpg',
        category: 'food',
        country: 'Italy',
        city: 'Rome',
        credits_cost: 15,
        expires_at: futureDate
      })
      .execute();

    await new Promise(resolve => setTimeout(resolve, 1));

    await db.insert(postsTable)
      .values({
        user_id: user.id,
        title: 'Expired Post 1',
        description: 'This post has expired',
        image_url: 'https://example.com/image3.jpg',
        category: 'lifestyle',
        country: 'France',
        city: 'Paris',
        credits_cost: 20,
        expires_at: pastDate
      })
      .execute();

    const result = await getUserDashboard(user.id);

    // Verify counts
    expect(result.active_posts_count).toEqual(2);
    expect(result.expired_posts_count).toEqual(1);
    expect(result.total_credits_spent).toEqual(45); // 10 + 15 + 20

    // Verify recent posts (should include all posts, ordered by creation date)
    expect(result.recent_posts).toHaveLength(3);
    
    // Posts should be ordered by creation date (most recent first)
    // "Expired Post 1" was created last, so it should be first
    expect(result.recent_posts[0].title).toEqual('Expired Post 1');
    expect(result.recent_posts[1].title).toEqual('Active Post 2');
    expect(result.recent_posts[2].title).toEqual('Active Post 1');

    // Verify user data
    expect(result.user.id).toEqual(user.id);
    expect(result.user.email).toEqual('user@example.com');
  });

  it('should limit recent posts to 10', async () => {
    // Create a test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'user@example.com',
        password_hash: 'hashed_password',
        credits: 500,
        is_admin: false
      })
      .returning()
      .execute();

    const user = userResult[0];
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Create 12 posts one by one to ensure different created_at times
    for (let i = 1; i <= 12; i++) {
      await db.insert(postsTable)
        .values({
          user_id: user.id,
          title: `Post ${i}`,
          description: `Description for post ${i}`,
          image_url: 'https://example.com/image.jpg',
          category: 'travel',
          country: 'USA',
          city: 'New York',
          credits_cost: 5,
          expires_at: futureDate
        })
        .execute();
      
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    const result = await getUserDashboard(user.id);

    // Should limit to 10 recent posts
    expect(result.recent_posts).toHaveLength(10);
    expect(result.active_posts_count).toEqual(12);
    expect(result.total_credits_spent).toEqual(60); // 12 * 5

    // Posts should be ordered by creation date (most recent first)
    // The most recent post should be "Post 12"
    expect(result.recent_posts[0].title).toEqual('Post 12');
    expect(result.recent_posts[9].title).toEqual('Post 3');
    
    // Verify all returned posts belong to our user
    result.recent_posts.forEach(post => {
      expect(post.user_id).toEqual(user.id);
      expect(post.credits_cost).toEqual(5);
      expect(post.category).toEqual('travel');
    });
  });

  it('should handle user with mixed post statuses correctly', async () => {
    // Create a test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'mixed@example.com',
        password_hash: 'hashed_password',
        credits: 50,
        is_admin: true
      })
      .returning()
      .execute();

    const user = userResult[0];
    const now = new Date();
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Create mix of active and expired posts with various credit costs
    await db.insert(postsTable)
      .values([
        {
          user_id: user.id,
          title: 'Active Travel Post',
          description: 'Active travel post',
          image_url: 'https://example.com/travel.jpg',
          category: 'travel',
          country: 'Japan',
          city: 'Tokyo',
          credits_cost: 25,
          expires_at: futureDate
        },
        {
          user_id: user.id,
          title: 'Expired Food Post',
          description: 'Expired food post',
          image_url: 'https://example.com/food.jpg',
          category: 'food',
          country: 'Thailand',
          city: 'Bangkok',
          credits_cost: 30,
          expires_at: pastDate
        },
        {
          user_id: user.id,
          title: 'Active Business Post',
          description: 'Active business post',
          image_url: 'https://example.com/business.jpg',
          category: 'business',
          country: 'Singapore',
          city: 'Singapore',
          credits_cost: 40,
          expires_at: futureDate
        }
      ])
      .execute();

    const result = await getUserDashboard(user.id);

    // Verify counts and calculations
    expect(result.active_posts_count).toEqual(2);
    expect(result.expired_posts_count).toEqual(1);
    expect(result.total_credits_spent).toEqual(95); // 25 + 30 + 40
    expect(result.recent_posts).toHaveLength(3);

    // Verify user data including admin status
    expect(result.user.is_admin).toEqual(true);
    expect(result.user.credits).toEqual(50);
  });

  it('should throw error for non-existent user', async () => {
    const nonExistentUserId = 99999;

    expect(getUserDashboard(nonExistentUserId))
      .rejects
      .toThrow(/User with ID 99999 not found/i);
  });

  it('should handle edge case with posts exactly at expiration boundary', async () => {
    // Create a test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'boundary@example.com',
        password_hash: 'hashed_password',
        credits: 100
      })
      .returning()
      .execute();

    const user = userResult[0];
    const exactlyNow = new Date();

    // Create a post that expires exactly at the current time
    await db.insert(postsTable)
      .values({
        user_id: user.id,
        title: 'Boundary Post',
        description: 'Post at expiration boundary',
        image_url: 'https://example.com/boundary.jpg',
        category: 'other',
        country: 'Test',
        city: 'Test',
        credits_cost: 10,
        expires_at: exactlyNow
      })
      .execute();

    const result = await getUserDashboard(user.id);

    // Post expiring exactly now should be considered expired
    // because the condition is gte(expires_at, now) for active posts
    expect(result.active_posts_count).toEqual(0);
    expect(result.expired_posts_count).toEqual(1);
    expect(result.total_credits_spent).toEqual(10);
    expect(result.recent_posts).toHaveLength(1);
  });
});