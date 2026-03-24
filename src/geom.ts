import { BoundingBox, OurData } from './dataTypes';

function getMinimalLongitudeRange(lons: number[]): { minLon: number; maxLon: number } | null {
    if (lons.length === 0) {
        return null;
    }

    const normalized = lons
        .filter((lon) => Number.isFinite(lon))
        .map((lon) => (lon < 0 ? lon + 360 : lon))
        .sort((a, b) => a - b);

    if (normalized.length === 0) {
        return null;
    }

    if (normalized.length === 1) {
        const lon = normalized[0] > 180 ? normalized[0] - 360 : normalized[0];
        return { minLon: lon, maxLon: lon };
    }

    let largestGap = -1;
    let gapIndex = -1;
    for (let i = 0; i < normalized.length; i++) {
        const current = normalized[i];
        const next = i === normalized.length - 1 ? normalized[0] + 360 : normalized[i + 1];
        const gap = next - current;
        if (gap > largestGap) {
            largestGap = gap;
            gapIndex = i;
        }
    }

    const rangeStart = gapIndex === normalized.length - 1 ? normalized[0] : normalized[gapIndex + 1];
    let rangeEnd = normalized[gapIndex];
    if (rangeEnd < rangeStart) {
        rangeEnd += 360;
    }

    if (rangeStart > 180 && rangeEnd > 180) {
        return { minLon: rangeStart - 360, maxLon: rangeEnd - 360 };
    }

    return {
        minLon: rangeStart > 180 ? rangeStart - 360 : rangeStart,
        maxLon: rangeEnd,
    };
}

export function getLatLons(d: OurData): number[][] {
    const lats: number[] = [];
    const lons: number[] = [];
    if (d.scatterData) {
        lats.push(d.scatterData.lat);
        lons.push(d.scatterData.lon);
    }
    if (d.lineData) {
        const p1 = d.lineData.point1;
        const p2 = d.lineData.point2;
        lats.push(p1.lat, p2.lat);
        lons.push(p1.lon, p2.lon);
    }
    if (d.arcData) {
        const p1 = d.arcData.point1;
        const p2 = d.arcData.point2;
        lats.push(p1.lat, p2.lat);
        lons.push(p1.lon, p2.lon);
    }
    if (d.pathData) {
        if (d.pathData.bbox) {
            lats.push(d.pathData.bbox[1], d.pathData.bbox[3]);
            lons.push(d.pathData.bbox[0], d.pathData.bbox[2]);
        } else {
            if (d.pathData.type === "LineString") {
                for (const coord of d.pathData.coordinates) {
                    lons.push(coord[0]);
                    lats.push(coord[1]);
                }
            } else if (d.pathData.type === "MultiLineString") {
                for (const line of d.pathData.coordinates) {
                    for (const coord of line) {
                        lons.push(coord[0]);
                        lats.push(coord[1]);
                    }
                }
            }
        }
    }
    if (d.polygonData) {
        if (d.polygonData.bbox) {
            lats.push(d.polygonData.bbox[1], d.polygonData.bbox[3]);
            lons.push(d.polygonData.bbox[0], d.polygonData.bbox[2]);
        } else {
            if (d.polygonData.type === "Polygon") {
                for (const ring of d.polygonData.coordinates) {
                    for (const coord of ring) {
                        lons.push(coord[0]);
                        lats.push(coord[1]);
                    }
                }
            } else if (d.polygonData.type === "MultiPolygon") {
                for (const polygon of d.polygonData.coordinates) {
                    for (const ring of polygon) {
                        for (const coord of ring) {
                            lons.push(coord[0]);
                            lats.push(coord[1]);
                        }
                    }
                }
            }
        }
    }
    return [lats, lons];
}


export function getDataBoundingBox(data: OurData[]): BoundingBox | null {
    let minLat = Infinity;
    let maxLat = -Infinity;
    const lons: number[] = [];
    for (const d of data) {
        const [lats, rowLons] = getLatLons(d);
        for (const lat of lats) {
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
        }
        lons.push(...rowLons);
    }
    const lonRange = getMinimalLongitudeRange(lons);
    if (!lonRange || minLat === Infinity || maxLat === -Infinity) {
        return null; // No valid data found
    }
    return { minLon: lonRange.minLon, minLat, maxLon: lonRange.maxLon, maxLat };
}


export function validateData(data: OurData): boolean {
    const [lats, lons] = getLatLons(data);
    for (const lat of lats) {
        if (isNaN(lat) || !isFinite(lat) || lat < -90 || lat > 90) {
            return false;
        }
    }
    for (const lon of lons) {
        if (isNaN(lon) || !isFinite(lon) || lon < -180 || lon > 180) {
            return false;
        }
    }
    return true;
}