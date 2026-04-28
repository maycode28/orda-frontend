import api from "@/lib/axios";
import type { ApiResponse } from "@/types/common.types";
import type {
  RecommendationCourse,
  RecommendationsResponseDto
} from "../types/recommendations.types";

const toRecommendationCourse = (
  item: RecommendationsResponseDto["recommendations"][number]
): RecommendationCourse => ({
  trailId: item.trail_id,
  name: item.name,
  distanceKm: item.distance_km,
  elevationGainM: item.elevation_gain_m,
  difficultyScore: item.difficulty_score,
  similarityScore: item.similarity_score
});

export const fetchRecommendations = async (
  topN = 5
): Promise<RecommendationCourse[]> => {
  const res = await api.get<ApiResponse<RecommendationsResponseDto>>(
    "/recommendations",
    {
      params: { top_n: topN }
    }
  );

  return res.data.data.recommendations.map(toRecommendationCourse);
};
