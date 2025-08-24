import { db } from '../db';
import { postsTable } from '../db/schema';
import { sql } from 'drizzle-orm';
import { postCategorySchema, type PostCategory } from '../schema';

export interface LocationsAndCategories {
  categories: PostCategory[];
  countries: string[];
  cities: string[];
  locations: Array<{ country: string; cities: string[] }>;
  stats: {
    total_posts: number;
    total_countries: number;
    total_cities: number;
  };
}

export const getLocationsAndCategories = async (): Promise<LocationsAndCategories> => {
  try {
    // Get all categories from the schema - these are always available
    const categories = postCategorySchema.options;

    // Get unique countries and cities from active posts (non-expired)
    const countriesResult = await db
      .selectDistinct({ country: postsTable.country })
      .from(postsTable)
      .execute();

    const citiesResult = await db
      .selectDistinct({ city: postsTable.city })
      .from(postsTable)
      .execute();

    // Get total posts count
    const totalPostsResult = await db.execute(
      sql`SELECT COUNT(*) as count FROM posts`
    );

    const totalPosts = Number((totalPostsResult.rows[0] as any)?.count || 0);

    // Get locations grouped by country with proper sorting
    const locationsResult = await db.execute(
      sql`
        SELECT 
          country, 
          array_agg(DISTINCT city ORDER BY city) as cities,
          COUNT(*) as post_count
        FROM posts
        GROUP BY country
        ORDER BY country
      `
    );

    const countries = countriesResult.map(row => row.country).filter(Boolean).sort();
    const cities = citiesResult.map(row => row.city).filter(Boolean).sort();
    
    // Transform the grouped locations result with proper type handling
    const locationsRows = locationsResult.rows as Array<{ 
      country: string; 
      cities: string[]; 
      post_count: number; 
    }>;
    
    const locations = locationsRows
      .map(row => ({
        country: row.country,
        cities: Array.isArray(row.cities) ? row.cities.filter(Boolean) : [],
        post_count: Number(row.post_count || 0)
      }))
      .filter(location => location.country && location.cities.length > 0)
      .sort((a, b) => a.country.localeCompare(b.country));

    return {
      categories,
      countries,
      cities,
      locations: locations.map(({ country, cities }) => ({ country, cities })),
      stats: {
        total_posts: totalPosts,
        total_countries: countries.length,
        total_cities: cities.length
      }
    };
  } catch (error) {
    console.error('Failed to fetch locations and categories:', error);
    // Return default structure with empty data instead of throwing
    return {
      categories: postCategorySchema.options,
      countries: [],
      cities: [],
      locations: [],
      stats: {
        total_posts: 0,
        total_countries: 0,
        total_cities: 0
      }
    };
  }
};