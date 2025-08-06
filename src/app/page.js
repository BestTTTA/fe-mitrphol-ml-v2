"use client";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useLoadScript } from "@react-google-maps/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const DEFAULT_LIMIT = 50000000;
const MAX_MARKERS_PER_ZONE = 1000000;

// Prediction thresholds (matching backend)
const PREDICTION_THRESHOLDS = {
  HIGH_MIN: 12.0,
  MEDIUM_MIN: 10.0,
  MEDIUM_MAX: 12.0,
  LOW_MAX: 10.0
};

function Map({ center }) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  // เปลี่ยนเป็นเดือนที่เชื่อมโยงกับปีและ model อัตโนมัติ - ใช้ useMemo เพื่อป้องกัน re-render
  const monthOptions = useMemo(() => [
    { value: 12, label: "ธันวาคม", year: 2024, model: "m12" },
    { value: 1, label: "มกราคม", year: 2025, model: "m1" },
    { value: 2, label: "กุมภาพันธ์", year: 2025, model: "m2" },
    { value: 3, label: "มีนาคม", year: 2025, model: "m3" },
  ], []);

  // ฟังก์ชันสำหรับหาข้อมูลเดือนที่เลือก
  const getSelectedMonthData = useCallback((selectedMonth) => {
    return monthOptions.find((month) => month.value === selectedMonth);
  }, [monthOptions]);

  // Zone centers - ใช้ useMemo เพื่อป้องกัน re-render
  const zoneCenters = useMemo(() => ({
    SB: { lat: 14.862504078842958, lng: 100.358549932741414 },
    MPDC: { lat: 14.84514, lng: 99.75922 },
    MAC: { lat: 15.828701000429223, lng: 104.47471520283926 },
    MPV: { lat: 16.67827120388637, lng: 102.44576336099253 },
    MPL: { lat: 7.067065149704857, lng: 117.59963900704362 },
    MPK: { lat: 16.4840064769643, lng: 102.1212705588527 },
    MKS: { lat: 16.462588608501633, lng: 104.04029264983633 },
    MKB: { lat: 16.096672809152835, lng: 101.87271858619893 },
  }), []);

  // State for filters
  const [filters, setFilters] = useState({
    year: 2024,
    start_month: 2,
    end_month: 8,
    selected_month: 12,
    models: ["m12"],
    zones: "MAC,MKB,MKS,MPDC,MPK,MPL,MPV,SB",
    limit: DEFAULT_LIMIT,
    group_by_level: true,
  });

  const [appliedFilters, setAppliedFilters] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(12);
  const [useGroupedAPI] = useState(true); // Remove setter เพื่อป้องกัน re-render
  const [dataLimit] = useState(DEFAULT_LIMIT); // Remove setter เพื่อป้องกัน re-render
  const [focusedZone, setFocusedZone] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [predictionData, setPredictionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState("");
  const [error, setError] = useState(null);
  const [cacheInfo, setCacheInfo] = useState(null);
  const [hasUnappliedChanges, setHasUnappliedChanges] = useState(false);

  // เก็บ reference ของ markers เพื่อ cleanup
  const markersRef = useRef([]);
  const mapRef = useRef(null);

  // ฟังก์ชัน cleanup markers เพื่อลด memory leak
  const clearAllMarkers = useCallback(() => {
    markersRef.current.forEach((marker) => {
      if (marker.setMap) {
        marker.setMap(null);
      }
    });
    markersRef.current = [];
  }, []);

  // ฟังก์ชันสำหรับ sampling ข้อมูลเพื่อลด markers
  const sampleData = useCallback((records, maxCount) => {
    if (!records || records.length <= maxCount) return records;
    const step = Math.ceil(records.length / maxCount);
    return records.filter((_, index) => index % step === 0);
  }, []);

  // Simulate loading progress
  const simulateLoadingProgress = useCallback(async (stages) => {
    for (let i = 0; i < stages.length; i++) {
      setLoadingStage(stages[i]);
      const stageProgress = ((i + 1) / stages.length) * 100;

      for (
        let progress = (i / stages.length) * 100;
        progress <= stageProgress;
        progress += 10
      ) {
        setLoadingProgress(Math.min(progress, 100));
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  }, []);

  // ฟังก์ชันสำหรับกำหนดระดับ prediction ตามเกณฑ์ใหม่
  const getPredictionLevel = useCallback((predictionValue) => {
    if (predictionValue > PREDICTION_THRESHOLDS.HIGH_MIN) {
      return {
        level: "High",
        color: "#22c55e",
        bgColor: "#f0fdf4",
        borderColor: "#bbf7d0",
      };
    } else if (predictionValue < PREDICTION_THRESHOLDS.LOW_MAX) {
      return {
        level: "Low",
        color: "#ef4444",
        bgColor: "#fef2f2",
        borderColor: "#fecaca",
      };
    } else {
      return {
        level: "Medium",
        color: "#f59e0b",
        bgColor: "#fffbeb",
        borderColor: "#fed7aa",
      };
    }
  }, []);

  // ฟังก์ชันสำหรับกำหนดสีและไอคอนตาม prediction level
  const getPredictionMarkerIcon = useCallback((predictionValue) => {
    if (predictionValue > PREDICTION_THRESHOLDS.HIGH_MIN) {
      return "http://maps.google.com/mapfiles/ms/icons/green-dot.png";
    } else if (predictionValue < PREDICTION_THRESHOLDS.LOW_MAX) {
      return "http://maps.google.com/mapfiles/ms/icons/red-dot.png";
    } else {
      return "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png";
    }
  }, []);

  // Fetch prediction data
  const fetchPredictionData = useCallback(
    async (filtersToUse) => {
      setLoading(true);
      setError(null);
      setLoadingProgress(0);
      setCacheInfo(null);

      try {
        const stages = [
          "Preparing prediction request...",
          "Fetching prediction data...",
          "Processing predictions...",
          "Optimizing markers...",
          "Rendering map...",
        ];

        simulateLoadingProgress(stages);
        setLoadingStage("Fetching prediction data...");
        setLoadingProgress(50);

        const requestBody = {
          year: filtersToUse.year,
          start_month: filtersToUse.start_month,
          end_month: filtersToUse.end_month,
          models: filtersToUse.models,
          zones: filtersToUse.zones,
          limit: filtersToUse.limit,
        };

        if (useGroupedAPI) {
          requestBody.group_by_level = filtersToUse.group_by_level;
        }

        const endpoint = useGroupedAPI ? "/predict/grouped" : "/predict";
        console.log(`Fetching predictions from ${endpoint} with:`, requestBody);

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          if (response.status === 400) {
            throw new Error("400");
          } else {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
        }

        setLoadingProgress(70);
        setLoadingStage("Processing predictions...");

        const data = await response.json();

        if (data.cached) {
          setCacheInfo({
            cached: data.cached,
            cache_key: data.cache_key,
            timestamp: new Date().toLocaleString()
          });
        }

        setLoadingProgress(85);
        setLoadingStage("Optimizing markers...");

        if (data.results && data.results.length > 0) {
          data.results = data.results.map((result) => {
            if (useGroupedAPI && result.prediction_groups) {
              result.prediction_groups = result.prediction_groups.map(group => ({
                ...group,
                predictions: sampleData(group.predictions, MAX_MARKERS_PER_ZONE)
              }));
            } else if (result.predictions) {
              result.predictions = sampleData(result.predictions, MAX_MARKERS_PER_ZONE);
            }
            return result;
          });
        }

        setPredictionData(data);
        setLoadingProgress(100);
        setLoadingStage("Complete!");

        setTimeout(() => {
          setLoadingProgress(0);
          setLoadingStage("");
        }, 1000);
      } catch (err) {
        setError(err.message);
        console.error("Error fetching prediction data:", err);
        setLoadingProgress(0);
        setLoadingStage("");
      } finally {
        setLoading(false);
      }
    },
    [simulateLoadingProgress, sampleData, useGroupedAPI]
  );

  // Clear cache function
  const clearCache = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/cache/clear`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log("Cache cleared:", result);
        setCacheInfo(null);
      }
    } catch (err) {
      console.error("Error clearing cache:", err);
    }
  }, []);

  // Apply filters function
  const applyFilters = useCallback(async () => {
    setHasUnappliedChanges(false);
    setAppliedFilters({ ...filters });
    clearAllMarkers();
    setPredictionData(null);
    await fetchPredictionData(filters);
  }, [filters, clearAllMarkers, fetchPredictionData]);

  // Handle filter changes
  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const handleMonthChange = useCallback((month) => {
    setSelectedMonth(month);
  }, []);

  const handleZoneFocus = useCallback(
    (zoneName) => {
      setFocusedZone(zoneName);
      setFilters((prev) => ({
        ...prev,
        zones: zoneName,
      }));

      if (mapInstance && zoneCenters[zoneName]) {
        mapInstance.panTo(zoneCenters[zoneName]);
        mapInstance.setZoom(10);
      }
    },
    [mapInstance, zoneCenters]
  );

  const resetZoneFocus = useCallback(() => {
    setFocusedZone(null);
    setFilters((prev) => ({
      ...prev,
      zones: "MAC,MKB,MKS,MPDC,MPK,MPL,MPV,SB",
    }));

    if (mapInstance) {
      mapInstance.panTo(center || { lat: 15.87, lng: 100.9925 });
      mapInstance.setZoom(7);
    }
  }, [mapInstance, center]);

  // Initial load - แก้ไข dependency
  useEffect(() => {
    let mounted = true;
    
    if (!appliedFilters && mounted) {
      applyFilters();
    }
    
    return () => {
      mounted = false;
    };
  }, []); // Empty dependency array - เรียกเพียงครั้งเดียว

  // Cleanup markers on unmount
  useEffect(() => {
    return () => {
      clearAllMarkers();
    };
  }, [clearAllMarkers]);

  // Track filter changes - แก้ไข dependency
  useEffect(() => {
    if (appliedFilters) {
      const filterKeys = ["year", "selected_month", "models", "zones", "limit"];
      const hasChanges = filterKeys.some((key) => {
        if (key === "models") {
          return (
            JSON.stringify(filters[key]) !== JSON.stringify(appliedFilters[key])
          );
        }
        return filters[key] !== appliedFilters[key];
      });

      setHasUnappliedChanges(hasChanges);
    }
  }, [filters, appliedFilters]);

  // Update filters when month selection changes - แก้ไข dependency
  useEffect(() => {
    const monthData = getSelectedMonthData(selectedMonth);
    if (monthData) {
      setFilters((prev) => ({
        ...prev,
        year: monthData.year,
        selected_month: selectedMonth,
        models: [monthData.model],
      }));
    }
  }, [selectedMonth]); // เอา getSelectedMonthData ออก

  // Initialize map with prediction markers - แก้ไข dependency
  useEffect(() => {
    if (!isLoaded || loadError || !predictionData) return;

    const initializeMap = () => {
      if (mapRef.current && window.google && window.google.maps) {
        clearAllMarkers();

        const map = new window.google.maps.Map(mapRef.current, {
          center: center || { lat: 15.87, lng: 100.9925 },
          zoom: 7,
          mapTypeId: "satellite",
        });

        setMapInstance(map);

        if (predictionData.results && predictionData.results.length > 0) {
          predictionData.results.forEach((modelResult) => {
            const modelName = modelResult.model_name;

            // Add zone statistics markers
            if (modelResult.zone_statistics) {
              modelResult.zone_statistics.forEach((zoneStat) => {
                const zoneCenter = zoneCenters[zoneStat.zone];
                if (!zoneCenter) return;

                const zoneMarker = new window.google.maps.Marker({
                  position: zoneCenter,
                  map,
                  title: `${zoneStat.zone} - ${modelName}`,
                  label: {
                    text: zoneStat.zone,
                    color: "#FFFFFF",
                    fontSize: "12px",
                    fontWeight: "bold",
                  },
                  icon: {
                    url: "/manufacturing-plant.png",
                    scaledSize: new window.google.maps.Size(60, 60),
                  },
                });
                markersRef.current.push(zoneMarker);

                const zoneInfoContent = `
                  <div style="max-width: 300px;">
                    <h3 style="margin: 0 0 10px 0; color: #333;">Zone: ${zoneStat.zone} - ${modelName}</h3>
                    <div style="margin-bottom: 10px;">
                      <strong>Prediction Statistics:</strong><br/>
                      Total Plantations: ${zoneStat.total_plantations}<br/>
                      High Prediction (>12): ${zoneStat.high_prediction_count} (${zoneStat.high_prediction_percentage.toFixed(1)}%)<br/>
                      Medium Prediction (10-12): ${zoneStat.medium_prediction_count} (${zoneStat.medium_prediction_percentage.toFixed(1)}%)<br/>
                      Low Prediction (<10): ${zoneStat.low_prediction_count} (${zoneStat.low_prediction_percentage.toFixed(1)}%)
                    </div>
                    <div style="margin-bottom: 10px;">
                      <strong>Average Prediction:</strong> ${zoneStat.average_prediction.toFixed(2)}
                    </div>
                    <div style="font-size: 12px; color: #666;">
                      <strong>Location:</strong><br/>
                      Lat: ${zoneCenter.lat}<br/>
                      Lng: ${zoneCenter.lng}
                    </div>
                  </div>
                `;

                const zoneInfoWindow = new window.google.maps.InfoWindow({
                  content: zoneInfoContent,
                });

                zoneMarker.addListener("click", () => {
                  zoneInfoWindow.open(map, zoneMarker);
                });
              });
            }

            // Add individual prediction markers
            let allPredictions = [];
            
            if (useGroupedAPI && modelResult.prediction_groups) {
              modelResult.prediction_groups.forEach(group => {
                allPredictions = allPredictions.concat(group.predictions);
              });
            } else if (modelResult.predictions) {
              allPredictions = modelResult.predictions;
            }

            if (allPredictions && allPredictions.length > 0) {
              allPredictions.forEach((prediction, index) => {
                if (
                  prediction.lat &&
                  prediction.lon &&
                  index < MAX_MARKERS_PER_ZONE
                ) {
                  const predictionIcon = getPredictionMarkerIcon(prediction.prediction);
                  const predictionLevel = getPredictionLevel(prediction.prediction);

                  const predictionMarker = new window.google.maps.Marker({
                    position: {
                      lat: parseFloat(prediction.lat),
                      lng: parseFloat(prediction.lon),
                    },
                    map,
                    title: `${prediction.zone} - ${modelName} - Prediction: ${prediction.prediction.toFixed(2)}`,
                    icon: predictionIcon,
                  });
                  markersRef.current.push(predictionMarker);

                  const predictionInfoContent = `
                    <div style="max-width: 350px;">
                      <h4 style="margin: 0 0 8px 0; color: ${predictionLevel.color}; font-weight: bold;">
                        📊 ${predictionLevel.level} Prediction
                      </h4>
                      <div style="background-color: ${predictionLevel.bgColor}; padding: 8px; border-radius: 4px; margin-bottom: 8px; border: 1px solid ${predictionLevel.borderColor};">
                        <p style="margin: 2px 0;"><strong>Model:</strong> ${modelName.toUpperCase()}</p>
                        <p style="margin: 2px 0;"><strong>Zone:</strong> ${prediction.zone}</p>
                        <p style="margin: 2px 0;"><strong>Plant ID:</strong> ${prediction.plant_id}</p>
                        <p style="margin: 2px 0;"><strong>Cane Type:</strong> ${prediction.cane_type}</p>
                        ${prediction.prediction_level ? `<p style="margin: 2px 0;"><strong>Level:</strong> ${prediction.prediction_level}</p>` : ''}
                      </div>
                      <div style="margin-bottom: 8px;">
                        <strong>Prediction Details:</strong><br/>
                        <span style="display: inline-block; margin: 2px 4px 2px 0; padding: 4px 8px; background-color: ${predictionLevel.bgColor}; border-radius: 3px; font-size: 14px; border: 1px solid ${predictionLevel.borderColor};">
                          <strong>Value:</strong> ${prediction.prediction.toFixed(3)}
                        </span><br/>
                        <span style="font-size: 11px; color: #888;">
                          Threshold: ${prediction.prediction > PREDICTION_THRESHOLDS.HIGH_MIN ? '>12 (High)' : prediction.prediction < PREDICTION_THRESHOLDS.LOW_MAX ? '<10 (Low)' : '10-12 (Medium)'}
                        </span>
                      </div>
                      <div style="margin-bottom: 8px;">
                        <strong>Vegetation Indices:</strong><br/>
                        <span style="display: inline-block; margin: 1px 2px; padding: 2px 4px; background-color: #f3f4f6; border-radius: 2px; font-size: 11px;">
                          NDVI: ${prediction.ndvi ? parseFloat(prediction.ndvi).toFixed(3) : "N/A"}
                        </span>
                        <span style="display: inline-block; margin: 1px 2px; padding: 2px 4px; background-color: #f3f4f6; border-radius: 2px; font-size: 11px;">
                          NDWI: ${prediction.ndwi ? parseFloat(prediction.ndwi).toFixed(3) : "N/A"}
                        </span>
                        <span style="display: inline-block; margin: 1px 2px; padding: 2px 4px; background-color: #f3f4f6; border-radius: 2px; font-size: 11px;">
                          GLI: ${prediction.gli ? parseFloat(prediction.gli).toFixed(3) : "N/A"}
                        </span><br/>
                        <span style="display: inline-block; margin: 1px 2px; padding: 2px 4px; background-color: #f3f4f6; border-radius: 2px; font-size: 11px;">
                          Precipitation: ${prediction.precipitation ? parseFloat(prediction.precipitation).toFixed(3) : "N/A"}
                        </span>
                      </div>
                      <div style="font-size: 12px; color: #666;">
                        <strong>Location:</strong> ${prediction.lat}, ${prediction.lon}
                      </div>
                    </div>
                  `;

                  const predictionInfoWindow = new window.google.maps.InfoWindow({
                    content: predictionInfoContent,
                  });

                  predictionMarker.addListener("click", () => {
                    predictionInfoWindow.open(map, predictionMarker);
                  });
                }
              });
            }
          });
        }

        console.log(`Map initialized with ${markersRef.current.length} markers`);
      }
    };

    initializeMap();
  }, [
    isLoaded,
    loadError,
    predictionData,
    center,
    zoneCenters,
    useGroupedAPI,
    // เอา functions ออกจาก dependency เพื่อป้องกัน infinite loop
  ]);

  if (!isLoaded) {
    return (
      <div className="w-full h-[600px] bg-sky-200 animate-pulse rounded-md flex items-center justify-center">
        <div className="text-gray-600">Loading Google Maps...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="text-red-600 p-4">
        Error loading Google Maps: {loadError.message}
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Apply Changes Button */}
      {hasUnappliedChanges && (
        <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg sticky top-0 z-50">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-orange-800 font-semibold">
                Changes Need to be Applied
              </h4>
              <p className="text-orange-700 text-sm">
                You have modified filters. Click Apply to fetch prediction data
                and update the map.
              </p>
            </div>
            <button
              onClick={applyFilters}
              disabled={loading}
              className={`px-6 py-3 rounded-lg font-semibold text-white transition-colors ${
                loading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-orange-500 hover:bg-orange-600 shadow-lg"
              }`}
            >
              {loading ? "Applying..." : "Apply Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Combined Filters and Zone Selection */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">
          Prediction Filters & Zone Selection
        </h3>

        {/* Month Filter */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">เดือน</label>
          <select
            value={selectedMonth}
            onChange={(e) => handleMonthChange(parseInt(e.target.value))}
            className="w-full md:w-1/2 p-2 border rounded"
          >
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="text-xs text-gray-500 mt-1">
            {(() => {
              const monthData = monthOptions.find(m => m.value === selectedMonth);
              return monthData
                ? `ปี: ${monthData.year} | Model: ${monthData.model.toUpperCase()} | Data range: Feb-Aug`
                : "Data range: Feb-Aug (fixed)";
            })()}
          </div>
        </div>

        {/* Zone Selection */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Zone Selection
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={resetZoneFocus}
              className={`px-3 py-2 rounded text-sm ${
                !focusedZone
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              All Zones
            </button>
            {Object.keys(zoneCenters).map((zoneName) => (
              <button
                key={zoneName}
                onClick={() => handleZoneFocus(zoneName)}
                className={`px-3 py-2 rounded text-sm ${
                  focusedZone === zoneName
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {zoneName}
              </button>
            ))}
          </div>
          {focusedZone && (
            <div className="text-sm text-gray-600">
              Currently focusing on zone: <strong>{focusedZone}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Prediction Statistics Summary */}
      {predictionData && predictionData.results && (
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              Prediction Statistics Summary
            </h3>
            <div className="text-sm text-green-600 flex items-center gap-2">
              <span>✅ Predictions loaded and current</span>
              <span className="text-xs bg-green-100 px-2 py-1 rounded">
                {markersRef.current.length} markers loaded
              </span>
              {useGroupedAPI && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  Grouped API
                </span>
              )}
            </div>
          </div>

          {predictionData.results.map((modelResult, modelIndex) => (
            <div key={modelIndex} className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-md font-semibold text-blue-600">
                  Model: {modelResult.model_name.toUpperCase()}
                  <span className="text-sm font-normal ml-2">
                    (Overall Average: {modelResult.overall_average.toFixed(2)})
                  </span>
                </h4>
                {modelResult.total_predictions && (
                  <span className="text-sm text-gray-600">
                    Total: {modelResult.total_predictions.toLocaleString()} predictions
                  </span>
                )}
              </div>

              {/* Grouped API - Show prediction groups */}
              {useGroupedAPI && modelResult.prediction_groups && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <h5 className="text-sm font-medium mb-2">Prediction Level Distribution:</h5>
                  <div className="grid grid-cols-3 gap-4">
                    {modelResult.prediction_groups.map((group, idx) => (
                      <div key={idx} className="text-center">
                        <div className={`text-lg font-bold ${
                          group.level === 'HIGH' ? 'text-green-600' :
                          group.level === 'MEDIUM' ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {group.count.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-600">
                          {group.level} ({group.percentage.toFixed(1)}%)
                        </div>
                        <div className="text-xs text-gray-500">
                          Avg: {group.average_prediction.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Zone Statistics Table */}
              {modelResult.zone_statistics && (
                <div className="overflow-x-auto">
                  <table className="min-w-full table-auto">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-4 py-2 text-left">Zone</th>
                        <th className="px-4 py-2 text-left">
                          Total Plantations
                        </th>
                        <th className="px-4 py-2 text-left">
                          High Prediction (&gt;12)
                        </th>
                        <th className="px-4 py-2 text-left">
                          Medium Prediction (10-12)
                        </th>
                        <th className="px-4 py-2 text-left">
                          Low Prediction (&lt;10)
                        </th>
                        <th className="px-4 py-2 text-left">
                          Average Prediction
                        </th>
                        <th className="px-4 py-2 text-left w-48">
                          Performance Distribution
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {modelResult.zone_statistics.map((zone, index) => (
                        <tr key={index} className="border-b">
                          <td className="px-4 py-2 font-medium">{zone.zone}</td>
                          <td className="px-4 py-2">
                            {zone.total_plantations.toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-green-600">
                            {zone.high_prediction_count.toLocaleString()} (
                            {zone.high_prediction_percentage.toFixed(1)}%)
                          </td>
                          <td className="px-4 py-2 text-yellow-600">
                            {zone.medium_prediction_count.toLocaleString()} (
                            {zone.medium_prediction_percentage.toFixed(1)}%)
                          </td>
                          <td className="px-4 py-2 text-red-600">
                            {zone.low_prediction_count.toLocaleString()} (
                            {zone.low_prediction_percentage.toFixed(1)}%)
                          </td>
                          <td className="px-4 py-2 font-semibold">
                            {zone.average_prediction.toFixed(2)}
                          </td>
                          <td className="px-4 py-2">
                            <div className="w-full bg-gray-200 rounded-full h-6 flex overflow-hidden">
                              <div
                                className="bg-green-500 h-full flex items-center justify-center text-white text-xs font-semibold"
                                style={{
                                  width: `${zone.high_prediction_percentage}%`,
                                }}
                              >
                                {zone.high_prediction_percentage > 15
                                  ? `${zone.high_prediction_percentage.toFixed(1)}%`
                                  : ""}
                              </div>
                              <div
                                className="bg-yellow-500 h-full flex items-center justify-center text-white text-xs font-semibold"
                                style={{
                                  width: `${zone.medium_prediction_percentage}%`,
                                }}
                              >
                                {zone.medium_prediction_percentage > 15
                                  ? `${zone.medium_prediction_percentage.toFixed(1)}%`
                                  : ""}
                              </div>
                              <div
                                className="bg-red-500 h-full flex items-center justify-center text-white text-xs font-semibold"
                                style={{
                                  width: `${zone.low_prediction_percentage}%`,
                                }}
                              >
                                {zone.low_prediction_percentage > 15
                                  ? `${zone.low_prediction_percentage.toFixed(1)}%`
                                  : ""}
                              </div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-600 mt-1">
                              <span>
                                High: {zone.high_prediction_percentage.toFixed(1)}%
                              </span>
                              <span>
                                Med: {zone.medium_prediction_percentage.toFixed(1)}%
                              </span>
                              <span>
                                Low: {zone.low_prediction_percentage.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Loading and Error States */}
      {loading && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-blue-800 font-medium">
              {loadingStage || "Loading prediction data..."}
            </p>
            <span className="text-blue-600 text-sm font-semibold">
              {loadingProgress}%
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-300 ease-out"
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
          <div className="mt-2 text-xs text-blue-600">
            {loadingProgress === 100
              ? "Prediction analysis complete!"
              : `Processing ${dataLimit.toLocaleString()} records with ${useGroupedAPI ? 'grouped API and ' : ''}memory optimization...`}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 p-4 rounded-lg">
          <p className="text-red-600">
            {error.includes("400") || error.includes("BAD_REQUEST")
              ? "Error loading prediction data"
              : `Error loading prediction data: ${error}`}
          </p>
          <p className="text-red-500 text-sm mt-1">
            Please modify your filters and click &quot;Apply Changes&quot; to try again.
          </p>
          <p className="text-blue-600 text-xs mt-1">
            💡 Try selecting a different month for better performance.
          </p>
        </div>
      )}

      {/* Updated Legend for Map Markers */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Map Legend & Prediction Thresholds</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium mb-2">Zone Markers</h4>
            <div className="flex items-center gap-2 mb-1">
              <img
                src="/manufacturing-plant.png"
                alt="Zone"
                className="w-6 h-6"
              />
              <span className="text-sm">Sugar Mill / Processing Plant</span>
            </div>
          </div>
          <div>
            <h4 className="font-medium mb-2">Prediction Levels (Fixed Thresholds)</h4>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                <span className="text-sm">High Prediction (&gt; 12.0)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                <span className="text-sm">Medium Prediction (10.0 - 12.0)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-500"></div>
                <span className="text-sm">Low Prediction (&lt; 10.0)</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 text-xs text-gray-600">
          💡 Click on any marker to see detailed prediction information including vegetation indices, exact thresholds, and location data.
          {useGroupedAPI && (
            <span className="block mt-1">
              🚀 Using Grouped API for better performance and automatic caching.
            </span>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="w-full">
        <div
          ref={mapRef}
          style={{ width: "100%", height: "600px" }}
          className="rounded-md shadow-md"
        />
      </div>
    </div>
  );
}

export default Map;