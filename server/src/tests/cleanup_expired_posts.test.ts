import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, postsTable } from '../db/schema';
import { cleanupExpiredPosts } from '../handlers/cleanup_expired_posts';
import { eq } from 'drizzle-orm';

describe('cleanupExpiredPosts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return 0 when no posts exist', async () => {
    const result = await cleanupExpiredPosts();
    expect(result).toEqual(0);
  });

  it('should return 0 when no expired posts exist', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        credits: 10,
        is_admin: false
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create a post that expires in the future
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // 7 days from now

    await db.insert(postsTable)
      .values({
        user_id: user.id,
        title: 'Future Post',
        description: 'A post that expires in the future',
        image_url: 'https://example.com/image.jpg',
        category: 'travel',
        country: 'USA',
        city: 'New York',
        credits_cost: 5,
        expires_at: futureDate
      })
      .execute();

    const result = await cleanupExpiredPosts();
    expect(result).toEqual(0);

    // Verify post still exists
    const posts = await db.select().from(postsTable).execute();
    expect(posts).toHaveLength(1);
  });

  it('should delete expired posts and return correct count', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        credits: 10,
        is_admin: false
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create expired posts
    const pastDate1 = new Date();
    pastDate1.setDate(pastDate1.getDate() - 1); // 1 day ago

    const pastDate2 = new Date();
    pastDate2.setDate(pastDate2.getDate() - 7); // 7 days ago

    await db.insert(postsTable)
      .values([
        {
          user_id: user.id,
          title: 'Expired Post 1',
          description: 'First expired post',
          image_url: 'https://example.com/image1.jpg',
          category: 'travel',
          country: 'USA',
          city: 'New York',
          credits_cost: 5,
          expires_at: pastDate1
        },
        {
          user_id: user.id,
          title: 'Expired Post 2',
          description: 'Second expired post',
          image_url: 'https://example.com/image2.jpg',
          category: 'food',
          country: 'France',
          city: 'Paris',
          credits_cost: 3,
          expires_at: pastDate2
        }
      ])
      .execute();

    const result = await cleanupExpiredPosts();
    expect(result).toEqual(2);

    // Verify posts were deleted
    const remainingPosts = await db.select().from(postsTable).execute();
    expect(remainingPosts).toHaveLength(0);
  });

  it('should only delete expired posts, leaving active ones', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        credits: 10,
        is_admin: false
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create mix of expired and active posts
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1); // 1 day ago

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // 7 days from now

    await db.insert(postsTable)
      .values([
        {
          user_id: user.id,
          title: 'Expired Post',
          description: 'This post is expired',
          image_url: 'https://example.com/expired.jpg',
          category: 'travel',
          country: 'USA',
          city: 'New York',
          credits_cost: 5,
          expires_at: pastDate
        },
        {
          user_id: user.id,
          title: 'Active Post',
          description: 'This post is still active',
          image_url: 'https://example.com/active.jpg',
          category: 'food',
          country: 'Italy',
          city: 'Rome',
          credits_cost: 3,
          expires_at: futureDate
        }
      ])
      .execute();

    const result = await cleanupExpiredPosts();
    expect(result).toEqual(1);

    // Verify only active post remains
    const remainingPosts = await db.select().from(postsTable).execute();
    expect(remainingPosts).toHaveLength(1);
    expect(remainingPosts[0].title).toEqual('Active Post');
    expect(remainingPosts[0].expires_at).toBeInstanceOf(Date);
    expect(remainingPosts[0].expires_at > new Date()).toBe(true);
  });

  it('should handle posts expiring exactly at current time', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        credits: 10,
        is_admin: false
      })
      .returning()
      .execute();

    const user = userResult[0];

    // Create post that expires very close to now (but in past)
    const almostNow = new Date();
    almostNow.setSeconds(almostNow.getSeconds() - 1); // 1 second ago

    await db.insert(postsTable)
      .values({
        user_id: user.id,
        title: 'Just Expired Post',
        description: 'Post that just expired',
        image_url: 'https://example.com/justexpired.jpg',
        category: 'technology',
        country: 'Japan',
        city: 'Tokyo',
        credits_cost: 10,
        expires_at: almostNow
      })
      .execute();

    const result = await cleanupExpiredPosts();
    expect(result).toEqual(1);

    // Verify post was deleted
    const remainingPosts = await db.select().from(postsTable).execute();
    expect(remainingPosts).toHaveLength(0);
  });

  it('should handle multiple users with expired posts', async () => {
    // Create multiple test users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        password_hash: 'hashedpassword1',
        credits: 10,
        is_admin: false
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        password_hash: 'hashedpassword2',
        credits: 15,
        is_admin: false
      })
      .returning()
      .execute();

    const user1 = user1Result[0];
    const user2 = user2Result[0];

    // Create expired posts for different users
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 2); // 2 days ago

    await db.insert(postsTable)
      .values([
        {
          user_id: user1.id,
          title: 'User 1 Expired Post',
          description: 'Expired post from user 1',
          image_url: 'https://example.com/user1.jpg',
          category: 'lifestyle',
          country: 'Canada',
          city: 'Toronto',
          credits_cost: 4,
          expires_at: pastDate
        },
        {
          user_id: user2.id,
          title: 'User 2 Expired Post',
          description: 'Expired post from user 2',
          image_url: 'https://example.com/user2.jpg',
          category: 'business',
          country: 'Germany',
          city: 'Berlin',
          credits_cost: 6,
          expires_at: pastDate
        }
      ])
      .execute();

    const result = await cleanupExpiredPosts();
    expect(result).toEqual(2);

    // Verify all expired posts were deleted regardless of user
    const remainingPosts = await db.select().from(postsTable).execute();
    expect(remainingPosts).toHaveLength(0);

    // Verify users still exist
    const users = await db.select().from(usersTable).execute();
    expect(users).toHaveLength(2);
  });
});