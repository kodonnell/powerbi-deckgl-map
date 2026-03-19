import { BoundingBox, OurData } from './dataTypes';

export function getDataBoundingBox(data: OurData[]): BoundingBox | null {
    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;

    for (const d of data) {
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

        for (const lat of lats) {
            if (lat < minLat) minLat = lat;
            else if (lat > maxLat) maxLat = lat;
        }
        for (const lon of lons) {
            if (lon < minLon) minLon = lon;
            else if (lon > maxLon) maxLon = lon;
        }
    }

    if (minLon === Infinity || minLat === Infinity || maxLon === -Infinity || maxLat === -Infinity) {
        return null; // No valid data found
    }

    return { minLon, minLat, maxLon, maxLat };
}
