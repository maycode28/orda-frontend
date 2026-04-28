import Header, { HEADER_HEIGHT } from "@/components/layout/Header";
import BackButton from "@/components/layout/BackButton";
import BottomNav from "@/components/layout/BottomNav";
import PageLoader from "@/components/ui/PageLoader";
import RecommendationCard from "@/features/recommendations/components/RecommendationCard";
import { useRecommendations } from "@/features/recommendations/hooks/useRecommendations";

const pageOffsetStyle = {
  paddingTop: HEADER_HEIGHT
} as const;

const RecommendationsPage = () => {
  const { data = [], isLoading, isError } = useRecommendations(5);
  const isFallback = data.length > 0 && data.every((item) => item.similarityScore <= 0);

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="bg-bg-page text-body min-h-screen">
      <Header leftSlot={<BackButton />} title="추천 코스" />

      <main
        style={pageOffsetStyle}
        className="bg-bg-page mx-auto min-h-screen w-full max-w-[390px] pb-24">
        <section className="px-4 pt-4">
          <div className="border-primary/10 overflow-hidden rounded-3xl border bg-white shadow-sm">
            <div className="bg-primary px-5 py-5 text-white">
              <p className="text-xs font-bold tracking-wider uppercase text-white/75">
                ORDA Recommendation
              </p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight">
                다음 산행 코스
              </h1>
              <p className="mt-2 text-sm leading-5 text-white/80">
                최근 등산 기록의 거리, 고도, 난이도를 바탕으로 어울리는
                코스를 골랐어요.
              </p>
            </div>

            <div className="grid grid-cols-3 divide-x divide-default px-3 py-4">
              <SummaryItem label="추천" value={`${data.length}`} unit="개" />
              <SummaryItem
                label="평균 거리"
                value={
                  data.length
                    ? (
                        data.reduce((sum, item) => sum + item.distanceKm, 0) /
                        data.length
                      ).toFixed(1)
                    : "-"
                }
                unit="km"
              />
              <SummaryItem
                label="평균 난이도"
                value={
                  data.length
                    ? (
                        data.reduce(
                          (sum, item) => sum + item.difficultyScore,
                          0
                        ) / data.length
                      ).toFixed(1)
                    : "-"
                }
                unit=""
              />
            </div>
          </div>
        </section>

        <section className="px-4 pt-4">
          {isError ? (
            <StatePanel message="추천 코스를 불러오지 못했습니다." />
          ) : data.length === 0 ? (
            <StatePanel message="추천할 코스를 준비하고 있습니다." />
          ) : (
            <>
              {isFallback && (
                <div className="border-primary/10 mb-3 rounded-2xl border bg-white px-4 py-3 shadow-sm">
                  <p className="text-heading text-sm font-bold">
                    등산 기록이 쌓이면 맞춤 추천이 시작돼요
                  </p>
                  <p className="text-muted mt-1 text-xs leading-5">
                    지금은 먼저 둘러보기 좋은 코스를 보여드릴게요.
                  </p>
                </div>
              )}

              <div className="flex snap-x gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {data.map((course, index) => (
                  <div
                    key={course.trailId}
                    className="w-[310px] shrink-0 snap-center">
                    <RecommendationCard course={course} rank={index + 1} />
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      <BottomNav />
    </div>
  );
};

interface SummaryItemProps {
  label: string;
  value: string;
  unit: string;
}

const SummaryItem = ({ label, value, unit }: SummaryItemProps) => (
  <div className="flex flex-col items-center px-2 text-center">
    <span className="text-muted text-[11px] font-bold">{label}</span>
    <span className="text-heading mt-1 text-lg font-extrabold">
      {value}
      {unit && <span className="text-muted ml-0.5 text-xs">{unit}</span>}
    </span>
  </div>
);

const StatePanel = ({ message }: { message: string }) => (
  <div className="border-primary/10 flex min-h-[180px] items-center justify-center rounded-3xl border bg-white px-4 text-center shadow-sm">
    <p className="text-muted text-sm font-semibold">{message}</p>
  </div>
);

export default RecommendationsPage;
