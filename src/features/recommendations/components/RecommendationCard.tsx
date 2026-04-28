import type { RecommendationCourse } from "../types/recommendations.types";

const getDifficultyTone = (score: number) => {
  if (score < 2) return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (score < 3) return "bg-lime-50 text-lime-700 border-lime-100";
  if (score < 4) return "bg-amber-50 text-amber-700 border-amber-100";
  return "bg-orange-50 text-orange-700 border-orange-100";
};

const formatSimilarity = (score: number) => {
  if (score <= 0) return null;
  return `${Math.round(score * 100)}%`;
};

interface RecommendationCardProps {
  course: RecommendationCourse;
  rank: number;
  variant?: "personalized" | "popular";
}

const RecommendationCard = ({
  course,
  rank,
  variant = "personalized"
}: RecommendationCardProps) => {
  const similarity = formatSimilarity(course.similarityScore);
  const isPopular = variant === "popular";

  return (
    <article className="border-primary/10 rounded-2xl border bg-white px-4 py-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-primary mb-1 text-[11px] font-bold tracking-wider uppercase">
            {isPopular ? `인기 ${rank}` : `추천 ${rank}`}
          </p>
          <h2 className="text-heading line-clamp-2 text-base font-bold tracking-tight">
            {course.name}
          </h2>
        </div>

        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${getDifficultyTone(
            course.difficultyScore
          )}`}>
          난이도 {course.difficultyScore.toFixed(1)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-bg-page rounded-xl px-3 py-3">
          <p className="text-muted text-[11px] font-semibold">거리</p>
          <p className="text-heading mt-1 text-lg font-bold">
            {course.distanceKm.toFixed(1)}
            <span className="text-muted ml-0.5 text-xs font-semibold">km</span>
          </p>
        </div>
        <div className="bg-bg-page rounded-xl px-3 py-3">
          <p className="text-muted text-[11px] font-semibold">누적 상승</p>
          <p className="text-heading mt-1 text-lg font-bold">
            {Math.round(course.elevationGainM)}
            <span className="text-muted ml-0.5 text-xs font-semibold">m</span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2">
        <span className="text-body text-xs font-semibold">
          {!isPopular && similarity
            ? `회원님의 취향과 ${similarity} 일치`
            : isPopular
              ? "이번 달 많이 오른 코스"
              : "등산 기록이 쌓이면 더 정교해져요"}
        </span>
        <span className="text-primary text-xs font-bold">
          {isPopular ? "인기" : "맞춤"}
        </span>
      </div>
    </article>
  );
};

export default RecommendationCard;
