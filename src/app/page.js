"use client";

import Filters from "@/components/Filters";
import Standards from "@/components/Standards";
import Map from "@/components/Map";
import StatisticsPanel from "@/components/StatisticsPanel";
import { useState } from "react";

const zoneCenters = {
  SB: { lat: 14.86250407773616, lng: 106.3585499327103 },
  MPDC: { lat: 14.84514, lng: 99.75922 },
  MAC: { lat: 15.828701000429223, lng: 104.47471520283926 },
  MPV: { lat: 16.67827120388637, lng: 102.44576336099253 },
  MPL: { lat: 7.067065149704857, lng: 117.59963900704362 },
  MPK: { lat: 16.4840064769643, lng: 102.1212705588527 },
  MKS: { lat: 16.462588608501633, lng: 104.04029264983633 },
  MPKB: { lat: 16.096672809152835, lng: 101.87271858619893 },
};

export default function Home() {
  const [selectedZone, setSelectedZone] = useState("SB");
  const center = zoneCenters[selectedZone] || zoneCenters["SB"];

  const handleZoneChange = (zone) => {
    setSelectedZone(zone);
  };

  return (
    <div className="flex p-4 gap-4 w-full">
      <div className="flex flex-col gap-6 flex-2/3 bg-white rounded-DEFAULT p-DEFAULT">
        <Map center={center} />
      </div>
      <div className="flex-1/3 bg-white rounded-DEFAULT">
        <StatisticsPanel />
      </div>
    </div>
  );
}
