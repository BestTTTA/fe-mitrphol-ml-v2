"use client";

import { useState } from "react";
import Image from "next/image";

// Standards grouped by A, B, and C
const groupedStandards = {
  A: [
    { key: "ndvi", label: "NDVI", value: 0.1 },
    { key: "gli", label: "GLI", value: 0.2 },
    { key: "ndwi", label: "NDWI", value: 0.5 },
    { key: "cigreen", label: "CIGreen", value: 0.1 },
    { key: "pvr", label: "PVR", value: 0.4 },
    { key: "tempt", label: "Temperature", value: 27.01 },
    { key: "soil_tempt", label: "Soil Temperature", value: 39 },
    { key: "solar_radiation", label: "Solar Radiation", value: 14 },
    { key: "soil_moizure", label: "Soil Moisture", value: 13 },
    { key: "precipitation", label: "Precipitation", value: 10 },
  ],
  B: [
    { key: "ndvi", label: "NDVI", value: 0.2 },
    { key: "gli", label: "GLI", value: 0.4 },
    { key: "ndwi", label: "NDWI", value: 0.7 },
    { key: "cigreen", label: "CIGreen", value: 0.2 },
    { key: "pvr", label: "PVR", value: 0.3 },
    { key: "tempt", label: "Temperature", value: 25 },
    { key: "soil_tempt", label: "Soil Temperature", value: 37 },
    { key: "solar_radiation", label: "Solar Radiation", value: 16 },
    { key: "soil_moizure", label: "Soil Moisture", value: 15 },
    { key: "precipitation", label: "Precipitation", value: 12 },
  ],
  C: [
    { key: "ndvi", label: "NDVI", value: 0.3 },
    { key: "gli", label: "GLI", value: 0.1 },
    { key: "ndwi", label: "NDWI", value: 0.4 },
    { key: "cigreen", label: "CIGreen", value: 0.05 },
    { key: "pvr", label: "PVR", value: 0.6 },
    { key: "tempt", label: "Temperature", value: 30 },
    { key: "soil_tempt", label: "Soil Temperature", value: 42 },
    { key: "solar_radiation", label: "Solar Radiation", value: 18 },
    { key: "soil_moizure", label: "Soil Moisture", value: 11 },
    { key: "precipitation", label: "Precipitation", value: 8 },
  ],
};

function Standards() {
  const [selectedGroup, setSelectedGroup] = useState("A");
  const [metrics, setMetrics] = useState(groupedStandards["A"]);

  const handleChange = (key, newValue) => {
    setMetrics((metrics) =>
      metrics.map((m) => (m.key === key ? { ...m, value: newValue } : m))
    );
  };

  const handleReset = () => {
    setMetrics(groupedStandards[selectedGroup]);
  };

  const handleResetMetric = (key) => {
    const defaultValue = groupedStandards[selectedGroup].find((m) => m.key === key)?.value;
    setMetrics((metrics) =>
      metrics.map((m) => (m.key === key ? { ...m, value: defaultValue } : m))
    );
  };

  const handleGroupChange = (e) => {
    const group = e.target.value;
    setSelectedGroup(group);
    setMetrics(groupedStandards[group]);
  };

  const chunkArray = (arr, size) => {
    const result = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-lg mb-2 text-DEFAULT">Standards</h1>
        <div className="flex gap-2 items-center">
          <select
            value={selectedGroup}
            onChange={handleGroupChange}
            className="border p-1 rounded"
          >
            <option value="A">Group A</option>
            <option value="B">Group B</option>
            <option value="C">Group C</option>
          </select>
          <button
            onClick={handleReset}
            className="p-2 rounded flex items-center gap-2 border group"
          >
            <Image
              src="/reset.png"
              width={20}
              height={20}
              alt="reset"
              className="group-hover:rotate-90 transition-transform duration-300 ease-in-out"
            />
            Reset All
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 pb-4">
        {chunkArray(metrics, 5).map((row, rowIndex) => (
          <div key={rowIndex} className="flex flex-row gap-4">
            {row.map((metric) => (
              <div key={metric.key}>
                <label className="mb-2 font-semibold">{metric.label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={metric.value}
                    onChange={(e) =>
                      handleChange(metric.key, parseFloat(e.target.value))
                    }
                    className="border rounded p-1 w-24 text-center"
                  />
                  <button
                    onClick={() => handleResetMetric(metric.key)}
                    className="flex items-center mr-8 group"
                  >
                    <Image
                      src="/reset.png"
                      width={20}
                      height={20}
                      alt="reset"
                      className="group-hover:rotate-90 transition-transform duration-300 ease-in-out"
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Standards;
