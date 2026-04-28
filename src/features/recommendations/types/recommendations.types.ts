export interface RecommendationCourse {
  trailId: string;
  name: string;
  distanceKm: number;
  elevationGainM: number;
  difficultyScore: number;
  similarityScore: number;
}

export interface RecommendationCourseDto {
  trail_id: string;
  name: string;
  distance_km: number;
  elevation_gain_m: number;
  difficulty_score: number;
  similarity_score: number;
}

export interface RecommendationsResponseDto {
  recommendations: RecommendationCourseDto[];
}
