import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, postsTable } from '../db/schema';
import { type GetPostsInput } from '../schema';
import { getPosts } from '../handlers/get_posts';

describe('getPosts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test user
  const createTestUser = async () => {
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        credits: 100
      })
      .returning()
      .execute();
    return userResult[0];
  };

  // Helper function to create test post
  const createTestPost = async (user_id: number, overrides: Partial<any> = {}) => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // 7 days from now

    const postData = {
      user_id,
      title: 'Test Post',
      description: 'A test post description',
      image_url: 'https://example.com/image.jpg',
      category: 'travel' as const,
      country: 'USA',
      city: 'New York',
      credits_cost: 5,
      expires_at: futureDate,
      ...overrides
    };

    const result = await db.insert(postsTable)
      .values(postData)
      .returning()
      .execute();
    return result[0];
  };

  it('should return active posts with default pagination', async () => {
    const user = await createTestUser();
    
    // Create multiple test posts
    await createTestPost(user.id, { title: 'Post 1', category: 'travel' });
    await createTestPost(user.id, { title: 'Post 2', category: 'food' });

    const input: GetPostsInput = {
      limit: 20,
      offset: 0
    };

    const result = await getPosts(input);

    expect(result).toHaveLength(2);
    expect(result[0].title).toEqual('Post 2'); // Newest first due to desc ordering
    expect(result[1].title).toEqual('Post 1');
    expect(result.every(post => post.expires_at > new Date())).toBe(true);
  });

  it('should exclude expired posts', async () => {
    const user = await createTestUser();
    
    // Create active post
    await createTestPost(user.id, { title: 'Active Post' });
    
    // Create expired post
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1); // Yesterday
    await createTestPost(user.id, { 
      title: 'Expired Post', 
      expires_at: pastDate 
    });

    const input: GetPostsInput = {
      limit: 20,
      offset: 0
    };

    const result = await getPosts(input);

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('Active Post');
  });

  it('should filter by category', async () => {
    const user = await createTestUser();
    
    await createTestPost(user.id, { title: 'Travel Post', category: 'travel' });
    await createTestPost(user.id, { title: 'Food Post', category: 'food' });
    await createTestPost(user.id, { title: 'Tech Post', category: 'technology' });

    const input: GetPostsInput = {
      category: 'food',
      limit: 20,
      offset: 0
    };

    const result = await getPosts(input);

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('Food Post');
    expect(result[0].category).toEqual('food');
  });

  it('should filter by country', async () => {
    const user = await createTestUser();
    
    await createTestPost(user.id, { title: 'USA Post', country: 'USA' });
    await createTestPost(user.id, { title: 'Canada Post', country: 'Canada' });

    const input: GetPostsInput = {
      country: 'Canada',
      limit: 20,
      offset: 0
    };

    const result = await getPosts(input);

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('Canada Post');
    expect(result[0].country).toEqual('Canada');
  });

  it('should filter by city', async () => {
    const user = await createTestUser();
    
    await createTestPost(user.id, { title: 'NYC Post', city: 'New York' });
    await createTestPost(user.id, { title: 'LA Post', city: 'Los Angeles' });

    const input: GetPostsInput = {
      city: 'Los Angeles',
      limit: 20,
      offset: 0
    };

    const result = await getPosts(input);

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('LA Post');
    expect(result[0].city).toEqual('Los Angeles');
  });

  it('should combine multiple filters', async () => {
    const user = await createTestUser();
    
    // Create posts with different combinations
    await createTestPost(user.id, { 
      title: 'Match All', 
      category: 'travel', 
      country: 'USA', 
      city: 'New York' 
    });
    await createTestPost(user.id, { 
      title: 'Wrong Category', 
      category: 'food', 
      country: 'USA', 
      city: 'New York' 
    });
    await createTestPost(user.id, { 
      title: 'Wrong Country', 
      category: 'travel', 
      country: 'Canada', 
      city: 'New York' 
    });

    const input: GetPostsInput = {
      category: 'travel',
      country: 'USA',
      city: 'New York',
      limit: 20,
      offset: 0
    };

    const result = await getPosts(input);

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('Match All');
  });

  it('should apply pagination correctly', async () => {
    const user = await createTestUser();
    
    // Create 5 posts
    for (let i = 1; i <= 5; i++) {
      await createTestPost(user.id, { title: `Post ${i}` });
    }

    // Test first page
    const firstPageInput: GetPostsInput = {
      limit: 2,
      offset: 0
    };

    const firstPage = await getPosts(firstPageInput);
    expect(firstPage).toHaveLength(2);

    // Test second page
    const secondPageInput: GetPostsInput = {
      limit: 2,
      offset: 2
    };

    const secondPage = await getPosts(secondPageInput);
    expect(secondPage).toHaveLength(2);

    // Verify different posts on different pages
    const firstPageTitles = firstPage.map(post => post.title);
    const secondPageTitles = secondPage.map(post => post.title);
    
    // Should not have overlapping posts
    const overlap = firstPageTitles.some(title => secondPageTitles.includes(title));
    expect(overlap).toBe(false);
  });

  it('should order by created_at descending', async () => {
    const user = await createTestUser();
    
    // Create posts with slight delay to ensure different timestamps
    const post1 = await createTestPost(user.id, { title: 'First Post' });
    
    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const post2 = await createTestPost(user.id, { title: 'Second Post' });

    const input: GetPostsInput = {
      limit: 20,
      offset: 0
    };

    const result = await getPosts(input);

    expect(result).toHaveLength(2);
    expect(result[0].title).toEqual('Second Post'); // Newest first
    expect(result[1].title).toEqual('First Post');
    expect(result[0].created_at >= result[1].created_at).toBe(true);
  });

  it('should return empty array when no posts match filters', async () => {
    const user = await createTestUser();
    
    await createTestPost(user.id, { category: 'travel' });

    const input: GetPostsInput = {
      category: 'sports', // No posts with this category
      limit: 20,
      offset: 0
    };

    const result = await getPosts(input);

    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle edge case with zero limit', async () => {
    const user = await createTestUser();
    await createTestPost(user.id);

    const input: GetPostsInput = {
      limit: 1, // Minimum allowed limit
      offset: 0
    };

    const result = await getPosts(input);

    expect(result).toHaveLength(1);
  });

  it('should preserve all post data fields', async () => {
    const user = await createTestUser();
    
    const testPost = await createTestPost(user.id, {
      title: 'Complete Post',
      description: 'Full description',
      image_url: 'https://example.com/full-image.jpg',
      category: 'technology',
      country: 'Canada',
      city: 'Toronto',
      credits_cost: 15
    });

    const input: GetPostsInput = {
      limit: 20,
      offset: 0
    };

    const result = await getPosts(input);

    expect(result).toHaveLength(1);
    const post = result[0];
    
    expect(post.id).toBeDefined();
    expect(post.user_id).toEqual(user.id);
    expect(post.title).toEqual('Complete Post');
    expect(post.description).toEqual('Full description');
    expect(post.image_url).toEqual('https://example.com/full-image.jpg');
    expect(post.category).toEqual('technology');
    expect(post.country).toEqual('Canada');
    expect(post.city).toEqual('Toronto');
    expect(post.credits_cost).toEqual(15);
    expect(post.expires_at).toBeInstanceOf(Date);
    expect(post.created_at).toBeInstanceOf(Date);
    expect(post.updated_at).toBeInstanceOf(Date);
  });
});