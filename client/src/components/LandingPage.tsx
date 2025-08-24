import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import { useState, useEffect, useCallback } from 'react';
import type { LocationsAndCategories } from '../../../server/src/handlers/get_locations_and_categories';

interface LandingPageProps {
  onGetStarted: () => void;
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  const [data, setData] = useState<LocationsAndCategories | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const result = await trpc.getLocationsAndCategories.query();
      setData(result);
    } catch (error) {
      console.error('Failed to load categories and locations:', error);
      setError('Failed to load content. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="text-amber-400 text-xl mb-4">✨ Loading Golden Timeline...</div>
          <div className="animate-pulse text-gray-400">Fetching categories and locations...</div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center">
        <div className="text-center max-w-md">
          <Alert className="bg-red-900/20 border-red-500/30 mb-4">
            <AlertDescription className="text-red-300">
              {error}
            </AlertDescription>
          </Alert>
          <Button 
            onClick={loadData}
            variant="outline"
            className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
          >
            🔄 Retry
          </Button>
        </div>
      </div>
    );
  }

  const categoryIcons: Record<string, string> = {
    travel: '✈️',
    food: '🍽️',
    lifestyle: '🌟',
    business: '💼',
    culture: '🎭',
    entertainment: '🎬',
    sports: '⚽',
    technology: '💻',
    art: '🎨',
    other: '📝'
  };

  const formatCategoryName = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-yellow-500/10"></div>
        <div className="relative container mx-auto px-4 py-20">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 bg-clip-text text-transparent mb-6">
              ✨ Golden Timeline
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-8 leading-relaxed">
              Share your moments in a premium timeline experience. 
              Connect with the world through curated posts that shine like gold.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                onClick={onGetStarted}
                size="lg"
                className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-black font-semibold px-8 py-4 text-lg shadow-lg hover:shadow-xl transition-all duration-300"
              >
                🚀 Get Started
              </Button>
              <div className="text-amber-400 font-medium">
                💎 Start with 10 free credits
              </div>
            </div>
            
            {data?.stats && (
              <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
                <div className="bg-gray-800/30 rounded-lg p-4 border border-amber-500/20">
                  <div className="text-2xl font-bold text-amber-400">{data.stats.total_posts}</div>
                  <div className="text-gray-300 text-sm">Golden Posts</div>
                </div>
                <div className="bg-gray-800/30 rounded-lg p-4 border border-amber-500/20">
                  <div className="text-2xl font-bold text-amber-400">{data.stats.total_countries}</div>
                  <div className="text-gray-300 text-sm">Countries</div>
                </div>
                <div className="bg-gray-800/30 rounded-lg p-4 border border-amber-500/20">
                  <div className="text-2xl font-bold text-amber-400">{data.stats.total_cities}</div>
                  <div className="text-gray-300 text-sm">Cities</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Categories Section */}
      <div className="container mx-auto px-4 py-16">
        <Card className="bg-gray-800/50 border-amber-500/20 backdrop-blur-sm shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-amber-400 mb-4">
              🏷️ Explore Categories
            </CardTitle>
            <p className="text-gray-300 text-lg">
              Discover amazing content across diverse categories
            </p>
            {data?.categories && (
              <p className="text-amber-400/70 text-sm mt-2">
                {data.categories.length} categories available
              </p>
            )}
          </CardHeader>
          <CardContent>
            {data?.categories && data.categories.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {data.categories.map((category: string) => (
                  <div
                    key={category}
                    className="group cursor-pointer"
                  >
                    <Card className="bg-gray-700/30 border-gray-600 hover:border-amber-500/50 hover:bg-gray-700/50 transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl mb-2 transition-transform group-hover:scale-110">
                          {categoryIcons[category] || '📝'}
                        </div>
                        <div className="text-amber-400 font-semibold text-sm group-hover:text-amber-300">
                          {formatCategoryName(category)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-400 py-8">
                <div className="text-4xl mb-4">🌟</div>
                <div className="text-lg">Categories will appear here once posts are created!</div>
                <div className="text-sm mt-2">Be the first to create a golden post</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Locations Section */}
      <div className="container mx-auto px-4 pb-16">
        <Card className="bg-gray-800/50 border-amber-500/20 backdrop-blur-sm shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-amber-400 mb-4">
              🌍 Featured Locations
            </CardTitle>
            <p className="text-gray-300 text-lg">
              Connect with posts from around the globe
            </p>
            {data?.stats && (
              <div className="flex justify-center gap-4 mt-4 text-sm">
                <span className="text-amber-400/70">
                  📍 {data.stats.total_cities} cities
                </span>
                <span className="text-amber-400/70">
                  🏛️ {data.stats.total_countries} countries
                </span>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {data?.locations && data.locations.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {data.locations.slice(0, 6).map((location) => (
                    <Card
                      key={location.country}
                      className="bg-gray-700/30 border-gray-600 hover:border-amber-500/50 hover:bg-gray-700/50 transition-all duration-300 hover:shadow-lg group"
                    >
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg text-amber-400 flex items-center gap-2 group-hover:text-amber-300">
                          🏛️ {location.country}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {location.cities.slice(0, 5).map((city: string) => (
                            <Badge
                              key={city}
                              variant="outline"
                              className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10 transition-colors"
                            >
                              📍 {city}
                            </Badge>
                          ))}
                          {location.cities.length > 5 && (
                            <Badge
                              variant="outline"
                              className="border-gray-500/30 text-gray-400 hover:border-amber-500/30 hover:text-amber-400 transition-colors"
                            >
                              +{location.cities.length - 5} more
                            </Badge>
                          )}
                        </div>
                        <div className="mt-3 text-xs text-gray-400">
                          {location.cities.length} {location.cities.length === 1 ? 'city' : 'cities'} featured
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                {data.locations.length > 6 && (
                  <div className="text-center mt-8">
                    <Badge
                      variant="outline"
                      className="border-amber-500/30 text-amber-300 text-lg px-4 py-2 hover:bg-amber-500/10 transition-colors"
                    >
                      ✨ And {data.locations.length - 6} more amazing locations to explore
                    </Badge>
                  </div>
                )}

                {/* Additional cities preview */}
                {data.cities && data.cities.length > 0 && (
                  <div className="mt-8 p-4 bg-gray-700/20 rounded-lg border border-amber-500/10">
                    <div className="text-center text-amber-400 font-semibold mb-3">
                      🏙️ All Featured Cities
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {data.cities.slice(0, 20).map((city: string) => (
                        <Badge
                          key={city}
                          variant="secondary"
                          className="bg-gray-600/30 text-gray-300 text-xs"
                        >
                          {city}
                        </Badge>
                      ))}
                      {data.cities.length > 20 && (
                        <Badge
                          variant="secondary"
                          className="bg-amber-500/20 text-amber-400 text-xs"
                        >
                          +{data.cities.length - 20} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-gray-400 py-12">
                <div className="text-6xl mb-6">🌍</div>
                <div className="text-xl mb-2">No locations featured yet</div>
                <div className="text-gray-500 mb-6">Share your location and be the first to appear on our golden map!</div>
                <Button 
                  onClick={onGetStarted}
                  variant="outline"
                  className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                >
                  🎯 Be the First
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Call to Action */}
      <div className="container mx-auto px-4 pb-20">
        <div className="text-center">
          <Card className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-amber-500/30 backdrop-blur-sm max-w-2xl mx-auto">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold text-amber-400 mb-4">
                ✨ Ready to Share Your Golden Moments?
              </h3>
              <p className="text-gray-300 mb-6 text-lg">
                Join our premium community and start creating posts that matter. 
                Your timeline awaits!
              </p>
              <Button 
                onClick={onGetStarted}
                size="lg"
                className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-black font-semibold px-8 py-4 text-lg"
              >
                🎯 Join Golden Timeline
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}