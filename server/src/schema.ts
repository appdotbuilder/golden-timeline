import { z } from 'zod';
import { randomBytes, pbkdf2Sync } from 'crypto';

// Password hashing function - consistent across application
export const hashPassword = (password: string): string => {
  const salt = randomBytes(32).toString('hex');
  const hash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

// User schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  credits: z.number().int().nonnegative(),
  is_admin: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Post category enum
export const postCategorySchema = z.enum([
  'travel',
  'food',
  'lifestyle',
  'business',
  'culture',
  'entertainment',
  'sports',
  'technology',
  'art',
  'other'
]);

export type PostCategory = z.infer<typeof postCategorySchema>;

// Post schema
export const postSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  title: z.string(),
  description: z.string(),
  image_url: z.string().url(),
  category: postCategorySchema,
  country: z.string(),
  city: z.string(),
  credits_cost: z.number().int().positive(),
  expires_at: z.coerce.date(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Post = z.infer<typeof postSchema>;

// User registration input schema
export const registerUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export type RegisterUserInput = z.infer<typeof registerUserInputSchema>;

// User login input schema
export const loginUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginUserInput = z.infer<typeof loginUserInputSchema>;

// Create post input schema
export const createPostInputSchema = z.object({
  user_id: z.number(),
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().min(1, 'Description is required').max(2000, 'Description must be less than 2000 characters'),
  image_url: z.string().url('Must be a valid URL'),
  category: postCategorySchema,
  country: z.string().min(1, 'Country is required'),
  city: z.string().min(1, 'City is required'),
  credits_cost: z.number().int().positive('Credits cost must be positive')
});

export type CreatePostInput = z.infer<typeof createPostInputSchema>;

// Update user credits input schema (admin only)
export const updateUserCreditsInputSchema = z.object({
  user_id: z.number(),
  credits: z.number().int().nonnegative(),
  admin_user_id: z.number() // ID of admin performing the action
});

export type UpdateUserCreditsInput = z.infer<typeof updateUserCreditsInputSchema>;

// Get user posts input schema
export const getUserPostsInputSchema = z.object({
  user_id: z.number(),
  include_expired: z.boolean().optional().default(false)
});

export type GetUserPostsInput = z.infer<typeof getUserPostsInputSchema>;

// Get posts input schema (with filters)
export const getPostsInputSchema = z.object({
  category: postCategorySchema.optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  limit: z.number().int().positive().max(100).optional().default(20),
  offset: z.number().int().nonnegative().optional().default(0)
});

export type GetPostsInput = z.infer<typeof getPostsInputSchema>;

// User dashboard data schema
export const userDashboardSchema = z.object({
  user: userSchema,
  active_posts_count: z.number().int().nonnegative(),
  expired_posts_count: z.number().int().nonnegative(),
  total_credits_spent: z.number().int().nonnegative(),
  recent_posts: z.array(postSchema)
});

export type UserDashboard = z.infer<typeof userDashboardSchema>;

// Authentication response schema
export const authResponseSchema = z.object({
  success: z.boolean(),
  user: userSchema.optional(),
  message: z.string().optional()
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

// Locations and categories response schema
export const locationsAndCategoriesSchema = z.object({
  categories: z.array(postCategorySchema),
  countries: z.array(z.string()),
  cities: z.array(z.string()),
  locations: z.array(z.object({
    country: z.string(),
    cities: z.array(z.string())
  }))
});

export type LocationsAndCategories = z.infer<typeof locationsAndCategoriesSchema>;