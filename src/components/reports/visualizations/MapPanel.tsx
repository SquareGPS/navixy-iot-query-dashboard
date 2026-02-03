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
}

/**
 * Component to fit map bounds to all markers
 */
function FitBounds({ points }: { points: GPSPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lon], 13);
    } else {
      const bounds = L.latLngBounds(
        points.map(p => [p.lat, p.lon] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, points]);

  return null;
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
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <FitBounds points={validPoints} />
          
          {validPoints.map((point, index) => (
            <Marker 
              key={`marker-${index}-${point.lat}-${point.lon}`}
              position={[point.lat, point.lon]}
            >
              <Popup>
                <PopupContent point={point} popupColumns={popupColumns} />
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <div className="text-xs text-muted-foreground mt-2">
        Showing {validPoints.length} location{validPoints.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

export default MapPanel;
