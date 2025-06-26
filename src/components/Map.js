"use client";
import { useEffect, useRef, useState } from "react";
import { useLoadScript } from "@react-google-maps/api";
import simulatedZoneData from "../mock-data/simulated_zone_data_extra_wide.json";

function Map({ center }) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });


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

  

  const mapRef = useRef(null);

  // Mock data for demonstration
  const data = [
    { latLon: "15.87-100.99", ndvi: 0.5, gli: 0.3 },
    { latLon: "16.00-101.10", ndvi: 0.7, gli: 0.4 },
  ];
  const standard = [
    { StandardZone: "default", ndvi: 0.6, gli: 0.35 },
  ];
  const selectedFields = ["ndvi", "gli"];
  const period = "default";

  useEffect(() => {
    if (!isLoaded || loadError) return;

    const initializeMap = () => {
      if (mapRef.current && window.google && window.google.maps) {
        const map = new window.google.maps.Map(mapRef.current, {
          center: center || { lat: 15.87, lng: 100.9925 },
          zoom: 8,
          mapTypeId: "satellite",
        });

        // Add center marker
        const centerMarker = new window.google.maps.Marker({
          position: center || { lat: 15.87, lng: 100.9925 },
          map,
          title: "Center",
          icon: {
            url: "/manufacturing-plant.png",
            scaledSize: new window.google.maps.Size(70, 70),
          },
          zIndex: 9999,
        });

        const centerInfoWindow = new window.google.maps.InfoWindow({
          content: `
            <div>
              <p style="font-weight: bold; color: #80D7F7;">Center Point</p>
              <p>Lat: ${center?.lat || 15.87}</p>
              <p>Lng: ${center?.lng || 100.9925}</p>
            </div>
          `,
        });

        centerMarker.addListener("click", () => {
          centerInfoWindow.open(map, centerMarker);
        });

        // Add markers for all zones
        Object.entries(zoneCenters).forEach(([zoneName, zoneCenter]) => {
          const zoneMarker = new window.google.maps.Marker({
            position: zoneCenter,
            map,
            title: zoneName,
            label: {
              text: zoneName,
              color: "#FFFFFF",
              fontSize: "12px",
              fontWeight: "bold",
            },
            icon: {
              url: "/manufacturing-plant.png",
              scaledSize: new window.google.maps.Size(60, 60),
            },
          });

          const zoneInfoWindow = new window.google.maps.InfoWindow({
            content: `
              <div>
                <p style="font-weight: bold; color: #333;">Zone: ${zoneName}</p>
                <p>Lat: ${zoneCenter.lat}</p>
                <p>Lng: ${zoneCenter.lng}</p>
              </div>
            `,
          });

          zoneMarker.addListener("click", () => {
            zoneInfoWindow.open(map, zoneMarker);
          });
        });

        data.forEach((item) => {
          const [lat, lon] = item.latLon.split("-").map(parseFloat);

          const matchingStandard = standard.find(
            (std) =>
              std.StandardZone.trim().toLowerCase() ===
              period.trim().toLowerCase()
          );

          let isGreater = false;
          let isLess = false;
          let isEqual = true;

          if (matchingStandard) {
            selectedFields.forEach((field) => {
              if (
                item[field] !== undefined &&
                matchingStandard[field] !== undefined
              ) {
                const itemValue = parseFloat(item[field]);
                const stdValue = parseFloat(matchingStandard[field]);

                if (itemValue > stdValue) {
                  isGreater = true;
                  isEqual = false;
                } else if (itemValue < stdValue) {
                  isLess = true;
                  isEqual = false;
                }
              }
            });
          }

          let color = "yellow";
          if (isGreater && !isLess) color = "green";
          else if (isLess) color = "red";

          const marker = new window.google.maps.Marker({
            position: { lat, lng: lon },
            map,
            title: `Lat: ${lat}, Lon: ${lon}`,
            icon:
              color === "green"
                ? "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
                : color === "yellow"
                ? "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png"
                : "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
          });

          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div>
                ${selectedFields
                  .map((field) => `<p>${field}: ${item[field]}</p>`)
                  .join("")}
                <p style="padding: 10px; font-weight: bold;">Lat: ${lat} | Lon: ${lon}</p>
              </div>
            `,
          });

          marker.addListener("click", () => {
            infoWindow.open(map, marker);
          });
        });

        // Plot all points from the imported JSON
        simulatedZoneData.forEach((entry) => {
          const [lat, lng] = entry.latLon.split("-").map(Number);
          const marker = new window.google.maps.Marker({
            position: { lat, lng },
            map,
            title: entry.zone,
            // No custom icon, use default marker
          });

          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div>
                <p style='font-weight:bold;'>Zone: ${entry.zone}</p>
                <p>Lat: ${lat}</p>
                <p>Lng: ${lng}</p>
                <p>NDVI: ${entry.NDVI}</p>
                <p>GLI: ${entry.GLI}</p>
                <p>NDWI: ${entry.NDWI}</p>
                <p>CIGreen: ${entry.CIGreen}</p>
                <p>PVR: ${entry.PVR}</p>
                <p>Temperature: ${entry.Temperature}</p>
                <p>Soil Temperature: ${entry["Soil Temperature"]}</p>
                <p>Solar Radiation: ${entry["Solar Radiation"]}</p>
                <p>Soil Moisture: ${entry["Soil Moisture"]}</p>
                <p>Precipitation: ${entry.Precipitation}</p>
                <p>Year: ${entry.year}</p>
                <p>Type: ${entry.sugarcaneType}</p>
                <p>Month: ${entry.month}</p>
              </div>
            `,
          });
          marker.addListener("click", () => {
            infoWindow.open(map, marker);
          });
        });
      }
    };

    initializeMap();
  }, [isLoaded, loadError, data, standard, selectedFields, period, center]);

  if (!isLoaded) {
    return (
      <div className="w-full h-[600px] bg-sky-200 animate-pulse rounded-md"></div>
    );
  }

  if (loadError) {
    return <div>Error loading Google Maps: {loadError.message}</div>;
  }

  return (
    <div className="w-full mt-3">
      <div
        ref={mapRef}
        style={{ width: "100%", height: "600px" }}
        className="rounded-md shadow-md drop-shadow-sm"
      />
    </div>
  );
}

export default Map;
