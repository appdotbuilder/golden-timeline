import { db } from '../db';
import { postsTable } from '../db/schema';
import { sql } from 'drizzle-orm';
import { postCategorySchema, type LocationsAndCategories } from '../schema';

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

    const countries = countriesResult.map(row => row.country).sort();
    const cities = citiesResult.map(row => row.city).sort();
    
    // Build locations grouped by country using the retrieved data
    // Create a map to group cities by country
    const countryToCity = new Map<string, Set<string>>();
    
    // Get all posts to build the grouping
    const allPosts = await db
      .select({ country: postsTable.country, city: postsTable.city })
      .from(postsTable)
      .execute();

    // Group cities by country
    allPosts.forEach(post => {
      if (!countryToCity.has(post.country)) {
        countryToCity.set(post.country, new Set());
      }
      countryToCity.get(post.country)!.add(post.city);
    });

    // Convert to the expected format
    const locations = Array.from(countryToCity.entries())
      .map(([country, citiesSet]) => ({
        country,
        cities: Array.from(citiesSet).sort()
      }))
      .sort((a, b) => a.country.localeCompare(b.country));

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