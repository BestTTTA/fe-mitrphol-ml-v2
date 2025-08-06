"use client";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useLoadScript } from "@react-google-maps/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:7890";

const DEFAULT_LIMIT = 500000000;
const MAX_MARKERS_PER_ZONE = 500000000;

function Map({ center }) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  // เปลี่ยนเป็นเดือนที่เชื่อมโยงกับปีและ model อัตโนมัติ
  const monthOptions = [
    { value: 12, label: "ธันวาคม", year: 2024, model: "m12" },
    { value: 1, label: "มกราคม", year: 2025, model: "m1" },
    { value: 2, label: "กุมภาพันธ์", year: 2025, model: "m2" },
    { value: 3, label: "มีนาคม", year: 2025, model: "m3" },
  ];

  // ฟังก์ชันสำหรับหาข้อมูลเดือนที่เลือก
  const getSelectedMonthData = useCallback((selectedMonth) => {
    return monthOptions.find((month) => month.value === selectedMonth);
  }, []);

  // State for filters - ปรับให้เหมาะกับ prediction API ใหม่
  const [filters, setFilters] = useState({
    year: 2024, // จะเปลี่ยนตามเดือนที่เลือก
    start_month: 2, // fix ไว้ที่ 2
    end_month: 8, // fix ไว้ที่ 8
    selected_month: 12, // เดือนที่เลือกแสดงในหน้าเว็บ
    models: ["m12"], // จะเปลี่ยนตามเดือนที่เลือก
    zones: "MAC,MKB,MKS,MPDC,MPK,MPL,MPV,SB",
    limit: DEFAULT_LIMIT,
    _t: Date.now(),
    no_cache: true,
  });

  const [appliedFilters, setAppliedFilters] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(12);

  // เพิ่ม state สำหรับการจัดการ performance
  const [dataLimit, setDataLimit] = useState(DEFAULT_LIMIT);

  const [focusedZone, setFocusedZone] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [predictionData, setPredictionData] = useState(null); // เปลี่ยนจาก analyticsData
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState("");
  const [error, setError] = useState(null);

  const [hasUnappliedChanges, setHasUnappliedChanges] = useState(false);

  // เก็บ reference ของ markers เพื่อ cleanup
  const markersRef = useRef([]);

  const zoneCenters = {
    SB: { lat: 14.862504078842958, lng: 100.358549932741414 },
    MPDC: { lat: 14.84514, lng: 99.75922 },
    MAC: { lat: 15.828701000429223, lng: 104.47471520283926 },
    MPV: { lat: 16.67827120388637, lng: 102.44576336099253 },
    MPL: { lat: 7.067065149704857, lng: 117.59963900704362 },
    MPK: { lat: 16.4840064769643, lng: 102.1212705588527 },
    MKS: { lat: 16.462588608501633, lng: 104.04029264983633 },
    MKB: { lat: 16.096672809152835, lng: 101.87271858619893 },
  };

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

  // Fetch prediction data - เปลี่ยนจาก analytics เป็น prediction
  const fetchPredictionData = useCallback(
    async (filtersToUse) => {
      setLoading(true);
      setError(null);
      setLoadingProgress(0);

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

        // เตรียม body สำหรับ POST request
        const requestBody = {
          year: filtersToUse.year,
          start_month: filtersToUse.start_month, // fix ที่ 2
          end_month: filtersToUse.end_month, // fix ที่ 8
          models: filtersToUse.models,
          zones: filtersToUse.zones,
          limit: filtersToUse.limit,
        };

        console.log(`Fetching predictions with:`, requestBody);

        const response = await fetch(`${API_BASE_URL}/predict`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
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

        setLoadingProgress(85);
        setLoadingStage("Optimizing markers...");

        // Optimize data by sampling if needed
        if (data.results && data.results.length > 0) {
          data.results = data.results.map((result) => ({
            ...result,
            predictions: sampleData(result.predictions, MAX_MARKERS_PER_ZONE),
          }));
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
    [simulateLoadingProgress, sampleData]
  );

  // Apply filters function
  const applyFilters = useCallback(async () => {
    setHasUnappliedChanges(false);
    setAppliedFilters({ ...filters });

    // Clear existing markers
    clearAllMarkers();
    setPredictionData(null);

    await fetchPredictionData(filters);
  }, [filters, clearAllMarkers, fetchPredictionData]);

  // Initial load
  useEffect(() => {
    if (!appliedFilters) {
      applyFilters();
    }
  }, [applyFilters, appliedFilters]);

  // Cleanup markers on unmount
  useEffect(() => {
    return () => {
      clearAllMarkers();
    };
  }, [clearAllMarkers]);

  // Track filter changes
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

      if (hasChanges) {
        setHasUnappliedChanges(true);
      }
    }
  }, [filters, appliedFilters]);

  // Update filters when month selection changes
  useEffect(() => {
    const monthData = getSelectedMonthData(selectedMonth);
    if (monthData) {
      setFilters((prev) => ({
        ...prev,
        year: monthData.year,
        selected_month: selectedMonth,
        models: [monthData.model],
        _t: Date.now(),
        no_cache: true,
      }));
    }
  }, [selectedMonth, getSelectedMonthData]);

  // ฟังก์ชันสำหรับกำหนดสีและไอคอนตาม prediction level ใช้ค่าคงที่
  const getPredictionMarkerIcon = useCallback((predictionValue) => {
    // ใช้เกณฑ์คงที่แทนการเปรียบเทียบกับค่าเฉลี่ย
    if (predictionValue > 12) {
      return "http://maps.google.com/mapfiles/ms/icons/green-dot.png"; // High prediction - เขียว
    } else if (predictionValue < 10) {
      return "http://maps.google.com/mapfiles/ms/icons/red-dot.png"; // Low prediction - แดง
    } else {
      return "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png"; // Medium prediction - เหลือง
    }
  }, []);

  // Initialize map with prediction markers
  useEffect(() => {
    if (!isLoaded || loadError || !predictionData) return;

    const initializeMap = () => {
      if (mapRef.current && window.google && window.google.maps) {
        // Clear existing markers first
        clearAllMarkers();

        const map = new window.google.maps.Map(mapRef.current, {
          center: center || { lat: 15.87, lng: 100.9925 },
          zoom: 7,
          mapTypeId: "satellite",
        });

        setMapInstance(map);

        // Process each model's results
        if (predictionData.results && predictionData.results.length > 0) {
          predictionData.results.forEach((modelResult) => {
            const modelName = modelResult.model_name;
            const averagePrediction = modelResult.overall_average || 12.5;

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
                    <h3 style="margin: 0 0 10px 0; color: #333;">Zone: ${
                      zoneStat.zone
                    } - ${modelName}</h3>
                    <div style="margin-bottom: 10px;">
                      <strong>Prediction Statistics:</strong><br/>
                      Total Plantations: ${zoneStat.total_plantations}<br/>
                      High Prediction: ${
                        zoneStat.high_prediction_count
                      } (${zoneStat.high_prediction_percentage.toFixed(
                  1
                )}%)<br/>
                      Medium Prediction: ${
                        zoneStat.medium_prediction_count
                      } (${zoneStat.medium_prediction_percentage.toFixed(
                  1
                )}%)<br/>
                      Low Prediction: ${
                        zoneStat.low_prediction_count
                      } (${zoneStat.low_prediction_percentage.toFixed(1)}%)
                    </div>
                    <div style="margin-bottom: 10px;">
                      <strong>Average Prediction:</strong> ${zoneStat.average_prediction.toFixed(
                        2
                      )}
                    </div>
                    <div>
            <label className="block text-sm font-medium mb-1">Data Limit</label>
            <select
              value={dataLimit}
              onChange={(e) => handleFilterChange("limit", parseInt(e.target.value))}
              className="w-full p-2 border rounded"
            >
              <option value={10000}>10,000 records (Fast)</option>
              <option value={50000}>50,000 records (Medium)</option>
              <option value={100000}>100,000 records (Slow)</option>
              <option value={DEFAULT_LIMIT}>Unlimited (Very Slow)</option>
            </select>
            <div className="text-xs text-gray-500 mt-1">
              Higher limits may affect performance
            </div>
          </div>
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
            if (modelResult.predictions && modelResult.predictions.length > 0) {
              modelResult.predictions.forEach((prediction, index) => {
                if (
                  prediction.lat &&
                  prediction.lon &&
                  index < MAX_MARKERS_PER_ZONE
                ) {
                  const predictionIcon = getPredictionMarkerIcon(
                    prediction.prediction,
                    averagePrediction
                  );

                  const predictionMarker = new window.google.maps.Marker({
                    position: {
                      lat: parseFloat(prediction.lat),
                      lng: parseFloat(prediction.lon),
                    },
                    map,
                    title: `${
                      prediction.zone
                    } - ${modelName} - Prediction: ${prediction.prediction.toFixed(
                      2
                    )}`,
                    icon: predictionIcon,
                  });
                  markersRef.current.push(predictionMarker);

                  // Create info window for individual predictions
                  const predictionLevel =
                    prediction.prediction >= averagePrediction * 1.1
                      ? {
                          level: "High",
                          color: "#22c55e",
                          bgColor: "#f0fdf4",
                          borderColor: "#bbf7d0",
                        }
                      : prediction.prediction <= averagePrediction * 0.9
                      ? {
                          level: "Low",
                          color: "#ef4444",
                          bgColor: "#fef2f2",
                          borderColor: "#fecaca",
                        }
                      : {
                          level: "Medium",
                          color: "#f59e0b",
                          bgColor: "#fffbeb",
                          borderColor: "#fed7aa",
                        };

                  const predictionInfoContent = `
                    <div style="max-width: 350px;">
                      <h4 style="margin: 0 0 8px 0; color: ${
                        predictionLevel.color
                      }; font-weight: bold;">
                        📊 ${predictionLevel.level} Prediction
                      </h4>
                      <div style="background-color: ${
                        predictionLevel.bgColor
                      }; padding: 8px; border-radius: 4px; margin-bottom: 8px; border: 1px solid ${
                    predictionLevel.borderColor
                  };">
                        <p style="margin: 2px 0;"><strong>Model:</strong> ${modelName.toUpperCase()}</p>
                        <p style="margin: 2px 0;"><strong>Zone:</strong> ${
                          prediction.zone
                        }</p>
                        <p style="margin: 2px 0;"><strong>Plant ID:</strong> ${
                          prediction.plant_id
                        }</p>
                        <p style="margin: 2px 0;"><strong>Cane Type:</strong> ${
                          prediction.cane_type
                        }</p>
                      </div>
                      <div style="margin-bottom: 8px;">
                        <strong>Prediction Details:</strong><br/>
                        <span style="display: inline-block; margin: 2px 4px 2px 0; padding: 4px 8px; background-color: ${
                          predictionLevel.bgColor
                        }; border-radius: 3px; font-size: 14px; border: 1px solid ${
                    predictionLevel.borderColor
                  };">
                          <strong>Value:</strong> ${prediction.prediction.toFixed(
                            3
                          )}
                        </span><br/>
                        <span style="font-size: 12px; color: #666;">
                          Range: ${prediction.prediction_lower_bound.toFixed(
                            2
                          )} - ${prediction.prediction_upper_bound.toFixed(2)}
                        </span>
                      </div>
                      <div style="margin-bottom: 8px;">
                        <strong>Vegetation Indices:</strong><br/>
                        <span style="display: inline-block; margin: 1px 2px; padding: 2px 4px; background-color: #f3f4f6; border-radius: 2px; font-size: 11px;">
                          NDVI: ${
                            prediction.ndvi ? prediction.ndvi.toFixed(3) : "N/A"
                          }
                        </span>
                        <span style="display: inline-block; margin: 1px 2px; padding: 2px 4px; background-color: #f3f4f6; border-radius: 2px; font-size: 11px;">
                          NDWI: ${
                            prediction.ndwi ? prediction.ndwi.toFixed(3) : "N/A"
                          }
                        </span>
                        <span style="display: inline-block; margin: 1px 2px; padding: 2px 4px; background-color: #f3f4f6; border-radius: 2px; font-size: 11px;">
                          GLI: ${
                            prediction.gli ? prediction.gli.toFixed(3) : "N/A"
                          }
                        </span><br/>
                        <span style="display: inline-block; margin: 1px 2px; padding: 2px 4px; background-color: #f3f4f6; border-radius: 2px; font-size: 11px;">
                          Precipitation: ${
                            prediction.precipitation
                              ? prediction.precipitation.toFixed(3)
                              : "N/A"
                          }
                        </span>
                      </div>
                      <div style="font-size: 12px; color: #666;">
                        <strong>Location:</strong> ${prediction.lat}, ${
                    prediction.lon
                  }
                      </div>
                    </div>
                  `;

                  const predictionInfoWindow =
                    new window.google.maps.InfoWindow({
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

        console.log(
          `Map initialized with ${markersRef.current.length} markers`
        );
      }
    };

    initializeMap();
  }, [
    isLoaded,
    loadError,
    predictionData,
    center,
    appliedFilters,
    clearAllMarkers,
    getPredictionMarkerIcon,
  ]);

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      _t: Date.now(),
      no_cache: true,
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
        _t: Date.now(),
        no_cache: true,
      }));

      if (mapInstance && zoneCenters[zoneName]) {
        mapInstance.panTo(zoneCenters[zoneName]);
        mapInstance.setZoom(10);
      }
    },
    [mapInstance]
  );

  const resetZoneFocus = useCallback(() => {
    setFocusedZone(null);
    setFilters((prev) => ({
      ...prev,
      zones: "MAC,MKB,MKS,MPDC,MPK,MPL,MPV,SB",
      _t: Date.now(),
      no_cache: true,
    }));

    if (mapInstance) {
      mapInstance.panTo(center || { lat: 15.87, lng: 100.9925 });
      mapInstance.setZoom(7);
    }
  }, [mapInstance, center]);

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
              const monthData = getSelectedMonthData(selectedMonth);
              return monthData
                ? `ปี: ${
                    monthData.year
                  } | Model: ${monthData.model.toUpperCase()} | Data range: Feb-Aug`
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
            </div>
          </div>

          {predictionData.results.map((modelResult, modelIndex) => (
            <div key={modelIndex} className="mb-6">
              <h4 className="text-md font-semibold mb-3 text-blue-600">
                Model: {modelResult.model_name.toUpperCase()}
                <span className="text-sm font-normal ml-2">
                  (Overall Average: {modelResult.overall_average.toFixed(2)})
                </span>
              </h4>

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
                            {zone.total_plantations}
                          </td>
                          <td className="px-4 py-2 text-green-600">
                            {zone.high_prediction_count} (
                            {zone.high_prediction_percentage.toFixed(1)}%)
                          </td>
                          <td className="px-4 py-2 text-yellow-600">
                            {zone.medium_prediction_count} (
                            {zone.medium_prediction_percentage.toFixed(1)}%)
                          </td>
                          <td className="px-4 py-2 text-red-600">
                            {zone.low_prediction_count} (
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
                                  ? `${zone.high_prediction_percentage.toFixed(
                                      1
                                    )}%`
                                  : ""}
                              </div>
                              <div
                                className="bg-yellow-500 h-full flex items-center justify-center text-white text-xs font-semibold"
                                style={{
                                  width: `${zone.medium_prediction_percentage}%`,
                                }}
                              >
                                {zone.medium_prediction_percentage > 15
                                  ? `${zone.medium_prediction_percentage.toFixed(
                                      1
                                    )}%`
                                  : ""}
                              </div>
                              <div
                                className="bg-red-500 h-full flex items-center justify-center text-white text-xs font-semibold"
                                style={{
                                  width: `${zone.low_prediction_percentage}%`,
                                }}
                              >
                                {zone.low_prediction_percentage > 15
                                  ? `${zone.low_prediction_percentage.toFixed(
                                      1
                                    )}%`
                                  : ""}
                              </div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-600 mt-1">
                              <span>
                                High:{" "}
                                {zone.high_prediction_percentage.toFixed(1)}%
                              </span>
                              <span>
                                Med:{" "}
                                {zone.medium_prediction_percentage.toFixed(1)}%
                              </span>
                              <span>
                                Low: {zone.low_prediction_percentage.toFixed(1)}
                                %
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
              : `Processing ${dataLimit.toLocaleString()} records with memory optimization...`}
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
            Please modify your filters and click "Apply Changes" to try again.
          </p>
          <p className="text-blue-600 text-xs mt-1">
            💡 Try selecting a different month or reducing the data limit for
            better performance.
          </p>
        </div>
      )}

      {/* Legend for Map Markers */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Map Legend</h3>
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
            <h4 className="font-medium mb-2">Prediction Levels</h4>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                <span className="text-sm">High Prediction (&gt; 12)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                <span className="text-sm">Medium Prediction (10-12)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-500"></div>
                <span className="text-sm">Low Prediction (&lt; 10)</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 text-xs text-gray-600">
          💡 Click on any marker to see detailed prediction information
          including vegetation indices, model confidence ranges, and location
          data.
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
