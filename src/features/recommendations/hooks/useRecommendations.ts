import { useQuery } from "@tanstack/react-query";
import { fetchRecommendations } from "../api/recommendationsApi";

export const useRecommendations = (topN = 5) =>
  useQuery({
    queryKey: ["recommendations", topN],
    queryFn: () => fetchRecommendations(topN),
    staleTime: 1000 * 60 * 10
  });
