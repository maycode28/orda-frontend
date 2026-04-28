/**
 * 📄 src/pages/hiking/HikingRecordPage.tsx
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import maplibregl from "maplibre-gl";
import { useHiking } from "@/features/hiking/hooks/useHiking";
import GpsTrackingMap from "@/features/gps/components/GpsTrackingMap";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/layout/BottomNav";
import Button from "@/components/ui/Button";
import Toast from "@/components/ui/Toast";
import { consumeAuthFlash } from "@/utils/authFlash";
import { checkNearbyTrail } from "@/features/trail/api/trailApi";
import { getTop100Mountains } from "@/features/mountain/api/mountainApi";
import { getTrailDifficultyMapByEdgeIds } from "@/features/trail/api/trailApi";
import type { Top100Mountain } from "@/features/mountain/types/mountainTypes";
import type { TrailGeoJson } from "@/features/trail/types/trail.types";
import Top100MountainBottomSheet from "@/features/mountain/components/Top100MountainBottomSheet";
import SummitCameraVerify from "@/features/summit/components/SummitCameraVerify";
import { verifySummitWithGps } from "@/features/summit/api/summitApi";
import type { PhotoVerifyResponse } from "@/features/summit/types/summit.types";
import ElevationChartCard from "@/features/hiking/components/ElevationChartCard";
import { mapElevationSeriesToSvgPath } from "@/features/hiking/mappers/hikingMappers";

import hikerIcon from "@/assets/hiking-icon.png";

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "쉬움",
  moderate: "보통",
  hard: "어려움",
  very_hard: "매우 어려움",
  extreme: "최상급"
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "#22c55e",
  moderate: "#84cc16",
  hard: "#eab308",
  very_hard: "#f97316",
  extreme: "#ef4444"
};

const PROXIMITY_RECHECK_DEBOUNCE_MS = 5000;

const formatRoundedMeters = (meters: number | null | undefined): string => {
  if (meters == null || Number.isNaN(meters)) return "0m";
  return `${Math.round(meters)}m`;
};

const formatSummitReason = (reason: string): string =>
  reason.replace(/(\d[\d,]*(?:\.\d+)?)\s*m/g, (match, value: string) => {
    const parsedValue = Number(value.replace(/,/g, ""));
    if (Number.isNaN(parsedValue)) return match;
    return formatRoundedMeters(parsedValue);
  });

const useElapsedTime = (isRunning: boolean) => {
  const [seconds, setSeconds] = useState(0);
  const [lastSeconds, setLastSeconds] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning) {
      startTimeRef.current = null;
      return;
    }
    startTimeRef.current = Date.now();
    const id = setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - (startTimeRef.current ?? Date.now())) / 1000
      );
      setSeconds(elapsed);
      setLastSeconds(elapsed);
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  return isRunning ? seconds : lastSeconds;
};

const formatTime = (totalSeconds: number): string => {
  const h = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
};

const StatItem = ({
  label,
  value,
  unit,
  bordered
}: {
  label: string;
  value: string | number;
  unit: string;
  bordered?: "both";
}) => (
  <div
    className={`flex flex-col items-center ${bordered === "both" ? "border-x border-slate-100" : ""}`}>
    <span className="mb-1 text-[10px] font-bold text-[#89943d] uppercase">
      {label}
    </span>
    <div className="flex items-baseline gap-0.5">
      <span className="text-2xl font-bold text-slate-900">{value}</span>
      <span className="text-xs font-medium text-slate-400">{unit}</span>
    </div>
  </div>
);

type PageState = "idle" | "hiking" | "finished";

export default function HikingRecordPage() {
  const navigate = useNavigate();
  const {
    geoJson,
    currentPos,
    isLoading,
    error,
    distanceKm,
    elevGain,
    currentAltitude,
    sessionId,
    nearbySummits,
    demElevations,
    start,
    end
  } = useHiking();

  const mapRef = useRef<maplibregl.Map | null>(null);
  const hikerRef = useRef<HTMLImageElement | null>(null);

  const [pageState, setPageState] = useState<PageState>("idle");
  const [trailLoaded, setTrailLoaded] = useState(false);
  const [hikerAnimating, setHikerAnimating] = useState(false);
  const [hikerStyle, setHikerStyle] = useState<React.CSSProperties>({});
  const [summitResult, setSummitResult] = useState<{
    verified: boolean;
    summitName?: string;
    distanceM?: number;
    aiReason?: string;
    verificationMethod?: string;
  } | null>(null);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  useEffect(() => {
    const msg = consumeAuthFlash();
    if (msg) setToast({ message: msg, type: "error" });
  }, []);

  const [idlePos, setIdlePos] = useState<{ lng: number; lat: number } | null>(
    null
  );

  const [isNearTrail, setIsNearTrail] = useState<boolean | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("error");

  useEffect(() => {
    if (!navigator.geolocation) return;
    if (pageState !== "idle") return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) =>
        setIdlePos({ lng: pos.coords.longitude, lat: pos.coords.latitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [pageState]);

  useEffect(() => {
    if (!idlePos || pageState !== "idle") return;

    const timerId = setTimeout(() => {
      checkNearbyTrail(idlePos.lat, idlePos.lng)
        .then((result) => {
          setIsNearTrail(result.nearTrail);
          if (!result.nearTrail) {
            setToastType("error");
            setToastMessage("등산로 근처에서만 등산을 시작할 수 있어요");
          }
        })
        .catch(() => {
          setIsNearTrail(null);
        });
    }, PROXIMITY_RECHECK_DEBOUNCE_MS);

    return () => clearTimeout(timerId);
  }, [idlePos, pageState]);

  const [isMountainMode, setIsMountainMode] = useState(false);
  const [mountains, setMountains] = useState<Top100Mountain[]>([]);
  const [selectedMountain, setSelectedMountain] =
    useState<Top100Mountain | null>(null);
  const [isMountainLoading, setIsMountainLoading] = useState(false);
  const [mountainTrailGeoJson, setMountainTrailGeoJson] =
    useState<TrailGeoJson | null>(null);
  const [isMountainTrailLoading, setIsMountainTrailLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleMountainModeToggle = async () => {
    if (isMountainMode) {
      setIsMountainMode(false);
      setMountains([]);
      setSelectedMountain(null);
      setMountainTrailGeoJson(null);
      return;
    }
    setIsMountainLoading(true);
    try {
      const data = await getTop100Mountains();
      setMountains(data);
      setIsMountainMode(true);
    } catch {
      setToast({ message: "명산 목록을 불러오지 못했습니다.", type: "error" });
    } finally {
      setIsMountainLoading(false);
    }
  };

  const handleMountainClick = useCallback(async (mountain: Top100Mountain) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setSelectedMountain(mountain);
    setMountainTrailGeoJson(null);
    setIsMountainTrailLoading(true);

    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [mountain.longitude, mountain.latitude],
        zoom: 13,
        duration: 800
      });
    }
    try {
      if (mountain.edgeIds && mountain.edgeIds.length > 0) {
        const trailData = await getTrailDifficultyMapByEdgeIds(
          mountain.edgeIds,
          signal
        );
        if (!signal.aborted) {
          setMountainTrailGeoJson(trailData);
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
      console.error("mountain trail load error", e);
    } finally {
      if (!signal.aborted) {
        setIsMountainTrailLoading(false);
      }
    }
  }, []);

  const elapsedSeconds = useElapsedTime(pageState === "hiking");

  const handleStart = async () => {
    const pos = currentPos ?? idlePos;

    if (hikerRef.current && mapRef.current && pos) {
      const markerPixel = mapRef.current.project([pos.lng, pos.lat]);
      const hikerRect = hikerRef.current.getBoundingClientRect();
      const hikerCenterX = hikerRect.left + hikerRect.width / 2;
      const hikerCenterY = hikerRect.top + hikerRect.height / 2;

      const mapContainer = mapRef.current.getContainer();
      const mapRect = mapContainer.getBoundingClientRect();

      const targetX = mapRect.left + markerPixel.x;
      const targetY = mapRect.top + markerPixel.y;

      const dx = targetX - hikerCenterX;
      const dy = targetY - hikerCenterY;

      setHikerAnimating(true);
      setHikerStyle({
        transform: `translate(${dx}px, ${dy}px)`,
        transition: "transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
        opacity: 1
      });

      setTimeout(async () => {
        const result = await start();
        setHikerAnimating(false);
        setHikerStyle({});
        if (result.success) {
          setPageState("hiking");
        } else if (result.errorMessage) {
          setToastType("error");
          setToastMessage(result.errorMessage);
        }
      }, 1200);
    } else {
      const result = await start();
      if (result.success) {
        setPageState("hiking");
      } else if (result.errorMessage) {
        setToastType("error");
        setToastMessage(result.errorMessage);
      }
    }
  };

  const [isVerifyLoading, setIsVerifyLoading] = useState(false);

  const handleVerify = async () => {
    if (!sessionId || !currentPos) return;
    setIsVerifyLoading(true);
    try {
      const result = await verifySummitWithGps({
        sessionId,
        latitude: currentPos.lat,
        longitude: currentPos.lng
      });
      setSummitResult({
        verified: result.verified,
        summitName: result.summitName,
        distanceM: result.distanceM,
        verificationMethod: "gps"
      });
    } catch {
      setToast({ message: "정상 인증에 실패했습니다.", type: "error" });
    } finally {
      setIsVerifyLoading(false);
    }
  };

  const handleVerified = (result: PhotoVerifyResponse) => {
    setSummitResult({
      verified: result.verified,
      summitName: result.summitName,
      distanceM: result.distanceM,
      aiReason: result.aiReason,
      verificationMethod: "photo"
    });
  };

  const handleEnd = async () => {
    try {
      await end();
      setPageState("finished");
      setShowFinishConfirm(false);
    } catch {
      setShowFinishConfirm(false);
    }
  };

  const handleMoveToCurrentPos = () => {
    const pos = currentPos ?? idlePos;
    if (mapRef.current && pos) {
      mapRef.current.flyTo({
        center: [pos.lng, pos.lat],
        zoom: 15,
        duration: 800
      });
    }
  };

  return (
    <div
      className="relative flex flex-col"
      style={{
        height: "100dvh",
        maxWidth: 390,
        margin: "0 auto",
        background: "#f7f7f6"
      }}>
      <Header />

      <div className="relative flex-1 overflow-hidden">
        <GpsTrackingMap
          geoJson={geoJson}
          currentPos={
            currentPos ??
            (idlePos
              ? { ...idlePos, altitude: null, accuracy: 0, timestamp: 0 }
              : null)
          }
          isTracking={pageState === "hiking"}
          hikerIconUrl={hikerIcon}
          nearbySummits={nearbySummits}
          onTrailLoaded={() => setTrailLoaded(true)}
          onMapReady={(map) => {
            mapRef.current = map;
          }}
          mountains={isMountainMode ? mountains : []}
          onMountainClick={handleMountainClick}
          mountainTrailGeoJson={mountainTrailGeoJson}
          isMountainMode={isMountainMode}
        />

        {pageState === "idle" && !selectedMountain && (
          <div
            style={{
              position: "absolute",
              bottom: 180,
              right: 10,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              zIndex: 50
            }}>
            <button
              onClick={handleMoveToCurrentPos}
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "white",
                border: "1px solid #e2e8f0",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                gap: 2
              }}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#89943d"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" />
                <line x1="12" y1="2" x2="12" y2="5" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="2" y1="12" x2="5" y2="12" />
                <line x1="19" y1="12" x2="22" y2="12" />
              </svg>
              <span style={{ fontSize: 9, color: "#89943d", fontWeight: 600 }}>
                현위치
              </span>
            </button>

            <button
              onClick={() => navigate("/recommendations")}
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "white",
                border: "1px solid #e2e8f0",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                gap: 2
              }}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#89943d"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <path d="M3 17l4-8 4 4 4-6 4 10" />
                <path d="M4 20h16" />
              </svg>
              <span style={{ fontSize: 8, color: "#89943d", fontWeight: 700 }}>
                추천
              </span>
            </button>

            <button
              onClick={handleMountainModeToggle}
              disabled={isMountainLoading}
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: isMountainMode ? "#89943d" : "white",
                border: `1px solid ${isMountainMode ? "#89943d" : "#e2e8f0"}`,
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                gap: 2,
                opacity: isMountainLoading ? 0.6 : 1
              }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>🏔</span>
              <span
                style={{
                  fontSize: 8,
                  color: isMountainMode ? "white" : "#89943d",
                  fontWeight: 700,
                  lineHeight: 1
                }}>
                {isMountainLoading ? "..." : isMountainMode ? "일반" : "명산"}
              </span>
            </button>
          </div>
        )}

        {trailLoaded && pageState === "idle" && (
          <div
            style={{
              position: "absolute",
              bottom: 180,
              left: 16,
              background: "white",
              borderRadius: 10,
              padding: "6px 8px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
              zIndex: 20,
              fontSize: 10
            }}>
            <div style={{ fontWeight: 600, marginBottom: 2, color: "#374151" }}>
              난이도
            </div>
            {Object.entries(DIFFICULTY_LABELS).map(([key, label]) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  marginBottom: 1
                }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: DIFFICULTY_COLORS[key]
                  }}
                />
                <span style={{ color: "#6b7280" }}>{label}</span>
              </div>
            ))}
          </div>
        )}

        {(pageState === "hiking" || pageState === "finished") && (
          <div
            className="transition-all duration-200"
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              background: "white",
              borderRadius: "24px 24px 0 0",
              padding: "12px 24px 24px",
              zIndex: 20,
              boxShadow: "0 -4px 20px rgba(0,0,0,0.1)"
            }}>
            <button
              type="button"
              onClick={() =>
                pageState === "hiking" && setIsPanelCollapsed((v) => !v)
              }
              aria-label={
                isPanelCollapsed ? "기록 패널 펼치기" : "기록 패널 접기"
              }
              aria-expanded={!isPanelCollapsed}
              className="transition-all duration-200"
              style={{
                display: "flex",
                justifyContent: "center",
                width: "100%",
                padding: "4px 0 8px",
                marginBottom:
                  pageState === "hiking" && isPanelCollapsed ? 4 : 8,
                background: "transparent",
                border: "none",
                cursor: pageState === "hiking" ? "pointer" : "default"
              }}>
              <div
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  background: "#e2e8f0"
                }}
              />
            </button>

            {pageState === "hiking" && isPanelCollapsed ? (
              <div
                className="transition-all duration-200"
                style={{
                  textAlign: "center",
                  padding: "4px 0 12px",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#475569",
                  fontVariantNumeric: "tabular-nums"
                }}>
                기록 중 · {formatTime(elapsedSeconds)} · {distanceKm.toFixed(2)}
                km
              </div>
            ) : (
              <div className="transition-all duration-200">
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#94a3b8",
                      letterSpacing: "0.2em",
                      marginBottom: 4
                    }}>
                    경과 시간
                  </div>
                  <div
                    style={{
                      fontSize: 40,
                      fontWeight: 700,
                      color: "#0f172a",
                      fontVariantNumeric: "tabular-nums"
                    }}>
                    {formatTime(elapsedSeconds)}
                  </div>
                </div>

                <div
                  className="grid grid-cols-3 gap-4"
                  style={{
                    borderTop: "1px solid #f1f5f9",
                    borderBottom: "1px solid #f1f5f9",
                    padding: "16px 0",
                    marginBottom: 16
                  }}>
                  <StatItem
                    label="이동 거리"
                    value={distanceKm.toFixed(2)}
                    unit="km"
                  />
                  <StatItem
                    label="누적 고도변동"
                    value={elevGain}
                    unit="m"
                    bordered="both"
                  />
                  <StatItem
                    label="현재 고도"
                    value={
                      currentAltitude != null
                        ? currentAltitude.toLocaleString()
                        : "—"
                    }
                    unit={currentAltitude != null ? "m" : ""}
                  />
                </div>

                <ElevationChartCard
                  variant="embedded"
                  svgPath={mapElevationSeriesToSvgPath(demElevations)}
                  xAxisLabels={[]}
                  isEmpty={
                    demElevations.filter((e): e is number => e != null).length <
                    2
                  }
                  showFilledArea={!demElevations.some((v) => v == null)}
                  emptyMessage="고도 데이터 수집 중..."
                />

                {summitResult && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: "10px 16px",
                      borderRadius: 12,
                      fontSize: 14,
                      fontWeight: 500,
                      background: summitResult.verified ? "#f0fdf4" : "#fefce8",
                      color: summitResult.verified ? "#15803d" : "#a16207"
                    }}>
                    {summitResult.verified
                      ? `🏔 ${summitResult.summitName ?? "정상"} 인증 완료${summitResult.verificationMethod === "photo" ? " (사진)" : ""}`
                      : `📍 ${
                          summitResult.aiReason
                            ? formatSummitReason(summitResult.aiReason)
                            : `${summitResult.summitName ?? "정상"}까지 약 ${formatRoundedMeters(
                                summitResult.distanceM
                              )} 떨어져 있습니다`
                        }`}
                  </div>
                )}

                {error && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: "10px 16px",
                      borderRadius: 12,
                      fontSize: 14,
                      background: "#fef2f2",
                      color: "#dc2626"
                    }}>
                    {error}
                  </div>
                )}
              </div>
            )}

            {pageState === "hiking" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  marginTop: 16
                }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    onClick={handleVerify}
                    disabled={!sessionId || !currentPos || isVerifyLoading}
                    style={{
                      flex: 1,
                      padding: "16px 0",
                      borderRadius: 16,
                      background: "#f1f5f9",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: 14,
                      color: "#0f172a",
                      opacity:
                        !sessionId || !currentPos || isVerifyLoading ? 0.4 : 1
                    }}>
                    {isVerifyLoading ? "인증 중..." : "📍 정상 인증"}
                  </button>
                  <button
                    onClick={() => setShowFinishConfirm(true)}
                    style={{
                      flex: 1.5,
                      padding: "16px 0",
                      borderRadius: 16,
                      background: "#89943d",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: 14,
                      color: "white"
                    }}>
                    종료
                  </button>
                </div>
                {summitResult?.verified &&
                  summitResult.verificationMethod === "gps" && (
                    <button
                      onClick={() => setShowCamera(true)}
                      style={{
                        width: "100%",
                        padding: "14px 0",
                        borderRadius: 16,
                        background: "transparent",
                        border: "2px solid #89943d",
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: 14,
                        color: "#89943d"
                      }}>
                      📷 사진 추가 인증 (보너스)
                    </button>
                  )}
              </div>
            )}

            {pageState === "finished" && (
              <Button
                variant="primary"
                onClick={() => {
                  setPageState("idle");
                  setSummitResult(null);
                }}>
                홈으로
              </Button>
            )}
          </div>
        )}

        {selectedMountain && (
          <Top100MountainBottomSheet
            mountain={selectedMountain}
            onClose={() => {
              setSelectedMountain(null);
              setMountainTrailGeoJson(null);
              setIsMountainTrailLoading(false);
              if (abortControllerRef.current) {
                abortControllerRef.current.abort();
              }
            }}
            isTrailLoading={isMountainTrailLoading}
            hasTrailData={
              !!mountainTrailGeoJson && mountainTrailGeoJson.features.length > 0
            }
          />
        )}
      </div>

      {pageState === "idle" && (
        <div
          style={{
            position: "absolute",
            bottom: 83,
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingBottom: 24,
            zIndex: 30
          }}>
          <img
            ref={hikerRef}
            src={hikerIcon}
            alt="등산 캐릭터"
            style={{
              width: 42,
              height: 42,
              marginBottom: 8,
              transition: hikerAnimating ? undefined : "none",
              ...hikerStyle
            }}
          />
          <button
            onClick={handleStart}
            disabled={hikerAnimating || isLoading || isNearTrail === false}
            style={{
              width: "calc(100% - 32px)",
              padding: "16px 0",
              borderRadius: 16,
              background: isNearTrail === false ? "#D7DACB" : "#89943d",
              color: isNearTrail === false ? "#7A8070" : "white",
              fontWeight: 700,
              fontSize: 18,
              border: "none",
              cursor: isNearTrail === false ? "not-allowed" : "pointer",
              boxShadow:
                isNearTrail === false
                  ? "none"
                  : "0 4px 12px rgba(137,148,61,0.3)",
              opacity: hikerAnimating || isLoading ? 0.6 : 1
            }}>
            {isLoading
              ? "연결 중..."
              : isNearTrail === false
                ? "등산로 근처로 이동하세요"
                : "등산 시작"}
          </button>
        </div>
      )}

      {pageState === "idle" && <BottomNav />}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {showCamera && sessionId && currentPos && (
        <SummitCameraVerify
          sessionId={sessionId}
          latitude={currentPos.lat}
          longitude={currentPos.lng}
          onClose={() => setShowCamera(false)}
          onVerified={handleVerified}
        />
      )}

      {showFinishConfirm && (
        <div
          className="absolute inset-0 z-20 flex items-end bg-black/50"
          onClick={() => setShowFinishConfirm(false)}>
          <div
            className="w-full rounded-t-3xl bg-white px-6 pt-5 pb-10"
            onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                background: "#e2e8f0",
                margin: "0 auto 16px"
              }}
            />
            <h2 className="mb-1 text-center text-xl font-bold text-slate-900">
              등산을 종료할까요?
            </h2>
            <p className="mb-6 text-center text-sm text-slate-400">
              {formatTime(elapsedSeconds)} 동안 {distanceKm.toFixed(2)}km 이동
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowFinishConfirm(false)}>
                계속하기
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleEnd}
                isLoading={isLoading}
                disabled={isLoading}>
                기록 저장
              </Button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setToastMessage(null)}
          duration={4000}
        />
      )}
    </div>
  );
}
