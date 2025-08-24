import { db } from '../db';
import { postsTable } from '../db/schema';
import { sql } from 'drizzle-orm';
import { postCategorySchema, type PostCategory } from '../schema';

export interface LocationsAndCategories {
  categories: PostCategory[];
  countries: string[];
  cities: string[];
  locations: Array<{ country: string; cities: string[] }>;
}

export const getLocationsAndCategories = async (): Promise<LocationsAndCategories> => {
  try {
    // Get all categories from the schema
    const categories = postCategorySchema.options;

    // Get unique countries and cities from posts
    const countriesResult = await db
      .selectDistinct({ country: postsTable.country })
      .from(postsTable)
      .execute();

    const citiesResult = await db
      .selectDistinct({ city: postsTable.city })
      .from(postsTable)
      .execute();

    // Get locations grouped by country
    const locationsResult = await db.execute(
      sql`
        SELECT country, array_agg(DISTINCT city) as cities
        FROM posts
        GROUP BY country
        ORDER BY country
      `
    );

    const countries = countriesResult.map(row => row.country).sort();
    const cities = citiesResult.map(row => row.city).sort();
    
    // Transform the grouped locations result - properly handle the query result type
    const locationsRows = locationsResult.rows as Array<{ country: string; cities: string[] }>;
    const locations = locationsRows.map(row => ({
      country: row.country,
      cities: Array.isArray(row.cities) ? row.cities.sort() : []
    }));

    return {
      categories,
      countries,
      cities,
      locations
    };
  } catch (error) {
    console.error('Failed to fetch locations and categories:', error);
    throw error;
  }
};