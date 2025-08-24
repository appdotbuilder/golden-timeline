import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import { 
  registerUserInputSchema, 
  loginUserInputSchema,
  createPostInputSchema,
  updateUserCreditsInputSchema,
  getUserPostsInputSchema,
  getPostsInputSchema
} from './schema';

// Import handlers
import { registerUser } from './handlers/register_user';
import { loginUser } from './handlers/login_user';
import { getUserDashboard } from './handlers/get_user_dashboard';
import { updateUserCredits } from './handlers/update_user_credits';
import { createPost } from './handlers/create_post';
import { getPosts } from './handlers/get_posts';
import { getUserPosts } from './handlers/get_user_posts';
import { getPostById } from './handlers/get_post_by_id';
import { cleanupExpiredPosts } from './handlers/cleanup_expired_posts';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User authentication routes
  registerUser: publicProcedure
    .input(registerUserInputSchema)
    .mutation(({ input }) => registerUser(input)),

  loginUser: publicProcedure
    .input(loginUserInputSchema)
    .mutation(({ input }) => loginUser(input)),

  // User dashboard route
  getUserDashboard: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getUserDashboard(input.userId)),

  // Admin route for updating user credits
  updateUserCredits: publicProcedure
    .input(updateUserCreditsInputSchema)
    .mutation(({ input }) => updateUserCredits(input)),

  // Post management routes
  createPost: publicProcedure
    .input(createPostInputSchema)
    .mutation(({ input }) => createPost(input)),

  getPosts: publicProcedure
    .input(getPostsInputSchema)
    .query(({ input }) => getPosts(input)),

  getUserPosts: publicProcedure
    .input(getUserPostsInputSchema)
    .query(({ input }) => getUserPosts(input)),

  getPostById: publicProcedure
    .input(z.object({ postId: z.number() }))
    .query(({ input }) => getPostById(input.postId)),

  // Maintenance route for cleaning up expired posts
  cleanupExpiredPosts: publicProcedure
    .mutation(() => cleanupExpiredPosts()),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`Golden Timeline TRPC server listening at port: ${port}`);
}

start();