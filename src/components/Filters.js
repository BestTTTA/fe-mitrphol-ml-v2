"use client";
import React, { useState } from "react";

function Filters({ onZoneChange, selectedZone }) {
  const zones = ["SB", "MPDC", "MAC", "MPV", "MPL", "MPK", "MKS", "MPKB"];

  const [selectedYear, setSelectedYear] = useState("2022");
  const years = ["2022", "2023", "2024", "2025"];

  const [selectedStage, setSelectedStage] = useState("Elegant");
  const stages = ["Elegant", "Tillering", "Stem Elongation", "Maturity"];

  const [selectedType, setSelectedType] = useState("พักดิน");
  const types = ["พักดิน", "อ้อยตอ", "อ้อยปลูก"];

  const metrics = [
    { key: "ndvi", label: "NDVI" },
    { key: "gli", label: "GLI" },
    { key: "ndwi", label: "NDWI" },
    { key: "cigreen", label: "CIGreen" },
    { key: "pvr", label: "PVR" },
    { key: "tempt", label: "Temperature" },
    { key: "soil_tempt", label: "Soil Temperature" },
    { key: "solar_radiation", label: "Solar Radiation" },
    { key: "soil_moizure", label: "Soil Moisture" },
    { key: "precipitation", label: "Precipitation" },
  ];

  const [selectedMetrics, setSelectedMetrics] = useState(
    metrics.map((m) => m.key)
  );

  const handleClick = (zone) => {
    if (onZoneChange) onZoneChange(zone);
  };

  const handleMetricChange = (key) => {
    setSelectedMetrics((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSelectAll = () => {
    if (selectedMetrics.length === metrics.length) {
      setSelectedMetrics([]);
    } else {
      setSelectedMetrics(metrics.map((m) => m.key));
    }
  };

  return (
    <div className="w-full">
      <h1 className="font-DEFAULT text-DEFAULT">Filters</h1>
      <div className="flex flex-col mt-DEFAULT">
        <h1 className="text-black text-BASE font-DEFAULT">Zone</h1>
        <div className="flex gap-DEFAULT">
          {zones.map((zone) => (
            <button
              key={zone}
              autoFocus={selectedZone === zone}
              className={`border-SECCOND text-DEFAULT border p-BUTTON rounded-DEFAULT hover:bg-DEFAULT hover:text-white transition-all duration-300 ease-in-out ${
                selectedZone === zone ? "bg-DEFAULT text-white" : ""
              }`}
              onClick={() => handleClick(zone)}
            >
              {zone}
            </button>
          ))}
        </div>
      </div>
      <div className="flex mt-DEFAULT gap-DEFAULT ">
        <div className="flex-1 flex-col ">
          <h1 className="text-black text-BASE font-DEFAULT">Year</h1>
          <select
            className="w-full border-DROPDOWN border rounded-DEFAULT p-BUTTON"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 flex-col ">
          <h1 className="text-black text-BASE font-DEFAULT">Growth Stage</h1>
          <select
            className="w-full border-DROPDOWN border rounded-DEFAULT p-BUTTON"
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
          >
            {stages.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 flex-col ">
          <h1 className="text-black text-BASE font-DEFAULT">ประเภทอ้อย</h1>
          <select
            className="w-full border-DROPDOWN border rounded-DEFAULT p-BUTTON"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            {types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col border-DROPDOWN rounded-DEFAULT mt-DEFAULT ">
        <h1 className="text-black text-BASE font-DEFAULT">Metrics</h1>
        <div className="flex flex-col gap-DEFAULT p-DEFAULT border border-DROPDOWN rounded-DEFAULT">
          <label className="flex items-center font-DEFAULT">
            <input
              type="checkbox"
              checked={selectedMetrics.length === metrics.length}
              onChange={handleSelectAll}
              className="accent-DEFAULT"
            />
            Select All
          </label>
          <div className="flex gap-DEFAULT">
            {metrics.map((metric) => (
              <label key={metric.key} className="text-BASE flex items-center">
                <input
                  type="checkbox"
                  checked={selectedMetrics.includes(metric.key)}
                  onChange={() => handleMetricChange(metric.key)}
                  className="accent-DEFAULT"
                />
                {metric.label}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Filters;
