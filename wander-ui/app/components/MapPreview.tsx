"use client";

import { useEffect, useState } from "react";
import { APIProvider, Map, AdvancedMarker, Pin } from "@vis.gl/react-google-maps";

export function MapPreview({ route }: { route: any }) {
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    // Access the public API key from Next.js environment
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
    setApiKey(key);
  }, []);

  if (!apiKey) return null;

  // Calculate center of the map based on waypoints
  const waypoints = route.waypoints || [];
  
  // Default to NYC if no waypoints
  let center = { lat: 40.7128, lng: -74.0060 };
  
  if (waypoints.length > 0) {
    let latSum = 0;
    let lngSum = 0;
    let validPoints = 0;
    
    // Add start if available
    if (route.start_lat && route.start_lng) {
      latSum += route.start_lat;
      lngSum += route.start_lng;
      validPoints++;
    }
    
    waypoints.forEach((wp: any) => {
      if (wp.lat && wp.lng) {
        latSum += wp.lat;
        lngSum += wp.lng;
        validPoints++;
      }
    });
    
    // Add end if available
    if (route.end_lat && route.end_lng) {
      latSum += route.end_lat;
      lngSum += route.end_lng;
      validPoints++;
    }

    if (validPoints > 0) {
      center = { lat: latSum / validPoints, lng: lngSum / validPoints };
    }
  }

  return (
    <div className="w-full h-full relative">
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={center}
          defaultZoom={14}
          mapId="wander_v3_map_id" // Requires a Map ID for AdvancedMarker
          gestureHandling="cooperative"
          disableDefaultUI={true}
          style={{ width: "100%", height: "100%" }}
        >
          {/* Start Marker */}
          {route.start_lat && route.start_lng && (
             <AdvancedMarker position={{ lat: route.start_lat, lng: route.start_lng }}>
               <Pin background={"#1e1e24"} borderColor={"#f4f4f5"} glyphColor={"#f4f4f5"} />
             </AdvancedMarker>
          )}

          {/* Waypoint Markers */}
          {waypoints.map((wp: any) => {
            if (!wp.lat || !wp.lng) return null;
            return (
              <AdvancedMarker key={wp.order} position={{ lat: wp.lat, lng: wp.lng }}>
                 <Pin background={"#8ba88e"} borderColor={"#1e1e24"} glyphColor={"#1e1e24"} />
              </AdvancedMarker>
            );
          })}

          {/* End Marker */}
          {route.end_lat && route.end_lng && (
             <AdvancedMarker position={{ lat: route.end_lat, lng: route.end_lng }}>
               <Pin background={"#e5d3b3"} borderColor={"#1e1e24"} glyphColor={"#1e1e24"} />
             </AdvancedMarker>
          )}
        </Map>
      </APIProvider>
    </div>
  );
}
