/**
 * MapPanel Component
 * Renders GPS coordinates on an interactive Leaflet map with marker clustering
 */

import React, { useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons in Leaflet (common issue with bundlers)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export interface GPSPoint {
  lat: number;
  lon: number;
  label?: string;
  data?: Record<string, unknown>;
}

export interface MapViewState {
  center: [number, number];
  zoom: number;
}

export interface MapPanelProps {
  /** Array of GPS points to display on the map */
  points: GPSPoint[];
  /** Optional title for the map section */
  title?: string;
  /** Height of the map container (default: 400px) */
  height?: number | string;
  /** Optional CSS class for styling */
  className?: string;
  /** Columns to show in popup (if not specified, shows all data) */
  popupColumns?: string[];
  /** Enable marker clustering for large datasets */
  enableClustering?: boolean;
  /** Callback when map view changes (center or zoom) */
  onViewChange?: (viewState: MapViewState) => void;
}

/**
 * Component to fit map bounds to all markers
 */
function FitBounds({ points }: { points: GPSPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    if (points.length === 1) {
      // Single point: zoom in reasonably close
      console.log(`[Map] Single point, setting zoom to 12`);
      map.setView([points[0].lat, points[0].lon], 12);
    } else {
      const bounds = L.latLngBounds(
        points.map(p => [p.lat, p.lon] as [number, number])
      );
      // First fit bounds to calculate optimal zoom
      map.fitBounds(bounds, { 
        padding: [50, 50]
      });
      // Then zoom in one level closer
      setTimeout(() => {
        const fitZoom = map.getZoom();
        const targetZoom = Math.min(fitZoom + 1, 18); // FitBounds + 1, max 18
        console.log(`[Map] FitBounds zoom: ${fitZoom}, zooming to: ${targetZoom}, points: ${points.length}`);
        map.setZoom(targetZoom);
      }, 100);
    }
  }, [map, points]);

  return null;
}

/**
 * Component to track view changes (zoom and pan) and report to parent
 */
function ViewTracker({ onViewChange }: { onViewChange?: (viewState: MapViewState) => void }) {
  const map = useMap();

  useEffect(() => {
    const handleViewChange = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      console.log(`[Map] View changed: zoom=${zoom}, center=[${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}]`);
      
      if (onViewChange) {
        onViewChange({
          center: [center.lat, center.lng],
          zoom: zoom
        });
      }
    };

    // Listen for both zoom and move (pan) events
    map.on('zoomend', handleViewChange);
    map.on('moveend', handleViewChange);

    // Report initial state after a short delay (after FitBounds completes)
    const timer = setTimeout(() => {
      handleViewChange();
    }, 500);

    return () => {
      map.off('zoomend', handleViewChange);
      map.off('moveend', handleViewChange);
      clearTimeout(timer);
    };
  }, [map, onViewChange]);

  return null;
}

/**
 * Show All button component - fits map to show all markers
 */
function ShowAllButton({ points }: { points: GPSPoint[] }) {
  const map = useMap();
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Disable click propagation to map using Leaflet's method
  useEffect(() => {
    if (buttonRef.current) {
      L.DomEvent.disableClickPropagation(buttonRef.current);
      L.DomEvent.disableScrollPropagation(buttonRef.current);
    }
  }, []);

  const handleShowAll = () => {
    if (points.length === 0) return;

    if (points.length === 1) {
      console.log(`[Map] Show All: Single point, setting zoom to 12`);
      map.setView([points[0].lat, points[0].lon], 12, { animate: true });
    } else {
      const bounds = L.latLngBounds(
        points.map(p => [p.lat, p.lon] as [number, number])
      );
      console.log(`[Map] Show All: Fitting bounds for ${points.length} points`);
      map.fitBounds(bounds, { 
        padding: [50, 50],
        animate: true
      });
      // Zoom in one level after fit
      setTimeout(() => {
        const fitZoom = map.getZoom();
        const targetZoom = Math.min(fitZoom + 1, 18);
        console.log(`[Map] Show All: FitBounds zoom: ${fitZoom}, zooming to: ${targetZoom}`);
        map.setZoom(targetZoom);
      }, 300);
    }
  };

  return (
    <div 
      className="leaflet-top leaflet-right" 
      style={{ 
        position: 'absolute', 
        top: 10, 
        right: 10, 
        zIndex: 1000,
        pointerEvents: 'auto'  // Override Leaflet's pointer-events: none on overlays
      }}
    >
      <button
        ref={buttonRef}
        onClick={handleShowAll}
        className="bg-white border border-gray-300 rounded px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        style={{ 
          cursor: 'pointer',
          pointerEvents: 'auto'  // Ensure button receives pointer events
        }}
        title="Fit map to show all locations"
      >
        Show all
      </button>
    </div>
  );
}

/**
 * Clickable marker that zooms to location when clicked
 */
function ClickableMarker({ 
  point, 
  index, 
  popupColumns 
}: { 
  point: GPSPoint; 
  index: number;
  popupColumns?: string[];
}) {
  const map = useMap();
  
  const handleClick = () => {
    const currentZoom = map.getZoom();
    const targetZoom = 10; // Zoom level when clicking on marker
    console.log(`[Map] Current zoom: ${currentZoom}, zooming to: ${targetZoom} at [${point.lat}, ${point.lon}]`);
    // Zoom in to the clicked location
    map.setView([point.lat, point.lon], targetZoom, { animate: true });
  };

  return (
    <Marker 
      key={`marker-${index}-${point.lat}-${point.lon}`}
      position={[point.lat, point.lon]}
      eventHandlers={{
        click: handleClick
      }}
    >
      <Popup>
        <PopupContent point={point} popupColumns={popupColumns} />
      </Popup>
    </Marker>
  );
}

/**
 * Format value for display in popup
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'object') {
    if (value instanceof Date) {
      return value.toLocaleString();
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    // Format numbers nicely
    if (Number.isInteger(value)) {
      return value.toLocaleString();
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }
  return String(value);
}

/**
 * Generate popup content from point data
 */
function PopupContent({ 
  point, 
  popupColumns 
}: { 
  point: GPSPoint; 
  popupColumns?: string[];
}) {
  const dataEntries = useMemo(() => {
    if (!point.data) return [];
    
    const entries = Object.entries(point.data);
    
    if (popupColumns && popupColumns.length > 0) {
      return entries.filter(([key]) => popupColumns.includes(key));
    }
    
    // Limit to 10 fields if showing all data
    return entries.slice(0, 10);
  }, [point.data, popupColumns]);

  return (
    <div className="map-popup-content" style={{ minWidth: 150 }}>
      {point.label && (
        <div style={{ 
          fontWeight: 600, 
          marginBottom: 8,
          borderBottom: '1px solid #e0e0e0',
          paddingBottom: 4
        }}>
          {point.label}
        </div>
      )}
      <table style={{ fontSize: '12px', width: '100%' }}>
        <tbody>
          <tr>
            <td style={{ fontWeight: 500, paddingRight: 8 }}>Lat:</td>
            <td>{point.lat.toFixed(6)}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 500, paddingRight: 8 }}>Lon:</td>
            <td>{point.lon.toFixed(6)}</td>
          </tr>
          {dataEntries.map(([key, value]) => (
            <tr key={key}>
              <td style={{ fontWeight: 500, paddingRight: 8 }}>{key}:</td>
              <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {formatValue(value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * MapPanel - Interactive map component for displaying GPS coordinates
 */
export function MapPanel({
  points,
  title,
  height = 400,
  className = '',
  popupColumns,
  onViewChange,
}: MapPanelProps) {
  const mapRef = useRef<L.Map>(null);

  // Filter and validate GPS points
  const validPoints = useMemo(() => {
    return points.filter(p => 
      typeof p.lat === 'number' &&
      typeof p.lon === 'number' &&
      !isNaN(p.lat) &&
      !isNaN(p.lon) &&
      p.lat >= -90 &&
      p.lat <= 90 &&
      p.lon >= -180 &&
      p.lon <= 180
    );
  }, [points]);

  // Calculate center point
  const center = useMemo<[number, number]>(() => {
    if (validPoints.length === 0) {
      return [51.505, -0.09]; // Default: London
    }
    
    const avgLat = validPoints.reduce((sum, p) => sum + p.lat, 0) / validPoints.length;
    const avgLon = validPoints.reduce((sum, p) => sum + p.lon, 0) / validPoints.length;
    
    return [avgLat, avgLon];
  }, [validPoints]);

  if (validPoints.length === 0) {
    return (
      <div 
        className={`flex items-center justify-center bg-muted rounded-lg ${className}`}
        style={{ height }}
      >
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">No GPS data available</p>
          <p className="text-sm mt-1">
            The query result doesn't contain valid GPS coordinates
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {title && (
        <h3 className="text-lg font-semibold mb-3">{title}</h3>
      )}
      <div 
        className="rounded-lg overflow-hidden border border-border"
        style={{ height }}
      >
        <MapContainer
          ref={mapRef}
          center={center}
          zoom={10}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <FitBounds points={validPoints} />
          <ViewTracker onViewChange={onViewChange} />
          <ShowAllButton points={validPoints} />
          
          {validPoints.map((point, index) => (
            <ClickableMarker 
              key={`marker-${index}-${point.lat}-${point.lon}`}
              point={point}
              index={index}
              popupColumns={popupColumns}
            />
          ))}
          
          {/* Custom Navixy attribution */}
          <div 
            className="leaflet-bottom leaflet-right"
            style={{ 
              position: 'absolute', 
              bottom: 5, 
              right: 5, 
              zIndex: 1000,
              pointerEvents: 'auto'
            }}
          >
            <a 
              href="https://www.navixy.com" 
              target="_blank" 
              rel="noopener noreferrer"
              title="Powered by Navixy"
              style={{ display: 'block' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g clipPath="url(#clip0_navixy)">
                  <path d="M9.92784 0.0618557C4.26804 1.05155 0.0927835 5.96907 0 11.7217V12.3402L10.3608 6.15464V0L9.92784 0.0618557Z" fill="#007AD2"/>
                  <path d="M24.064 11.8763C24.033 6.06186 19.8578 1.08247 14.1361 0.0618557L13.7031 0V6.21649L24.064 12.4948V11.8763Z" fill="#007AD2"/>
                  <path d="M0.772149 16.1754C1.63813 18.4331 3.12266 20.3816 5.10205 21.7733C7.14328 23.196 9.52473 23.9692 12.0299 23.9692C14.5041 23.9692 16.8855 23.227 18.8959 21.8043C20.8752 20.4434 22.3598 18.5259 23.2258 16.2991L23.3185 16.0208L11.999 9.15479L0.648438 15.928L0.772149 16.1754Z" fill="#007AD2"/>
                </g>
                <defs>
                  <clipPath id="clip0_navixy">
                    <rect width="24" height="24" fill="white"/>
                  </clipPath>
                </defs>
              </svg>
            </a>
          </div>
        </MapContainer>
      </div>
      <div className="text-xs text-muted-foreground mt-2">
        Showing {validPoints.length} location{validPoints.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

export default MapPanel;
