
import powerbi from "powerbi-visuals-api";
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import ISelectionId = powerbi.visuals.ISelectionId;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import { decode } from "./encoding";
import { OurData } from "./dataPoint";
import { InputGeometryType } from "./enum";
import { VisualFormattingSettingsModel } from "./settings";
import { WKTLoader } from '@loaders.gl/wkt';
import { parseSync } from '@loaders.gl/core';

const getNumberFromPrimitive = (value: powerbi.PrimitiveValue): number | null => {
    if (value === null) {
        return null;
    }
    const num = parseFloat(value.toString());
    return Number.isNaN(num) ? null : num;
}

const getNumberFromValue = (col: powerbi.DataViewValueColumn | null, i: number): number | null => {
    if (!col || !col.values) {
        return null;
    }
    return getNumberFromPrimitive(col.values[i]);
}

const validLat = (lat: number): boolean => {
    return isFinite(lat) && lat >= -90 && lat <= 90;
}
const validLon = (lon: number): boolean => {
    return isFinite(lon) && lon >= -180 && lon <= 180;
}

export function createSelectorDataPoints(options: VisualUpdateOptions, settings: VisualFormattingSettingsModel, host: IVisualHost, decodeCache: object): OurData[] {
    const dataPoints: OurData[] = []
    const dataViews = options.dataViews;

    if (!dataViews || !dataViews[0]
    ) {
        return dataPoints;
    }

    if (dataViews.length > 1) {
        host.displayWarningIcon('Multiple dataviews found.', 'This visual only supports a single dataview. Please remove any extra dataviews.');
    }

    const categorical = dataViews[0].categorical;
    if (!categorical || !categorical.categories || !categorical.values) {
        return dataPoints;
    }


    const geometryIdValue = categorical.categories[0];
    if (!geometryIdValue) {
        // No index (usually CTUID)
        return dataPoints;
    }

    console.log("Processing n rows of data:", geometryIdValue.values.length);

    const geometryTypeValue = categorical.values.filter(x => x.source.roles.geometryType)[0];
    if (!geometryTypeValue) {
        // No geometry
        return dataPoints;
    }

    // Geometry stuff:
    const wkp = categorical.values.filter(x => x.source.roles.wkp)[0];
    const wkt = categorical.values.filter(x => x.source.roles.wkt)[0];
    const point1LatitudeValue = categorical.values.filter(x => x.source.roles.point1Latitude)[0];
    const point1LongitudeValue = categorical.values.filter(x => x.source.roles.point1Longitude)[0];
    const point2LatitudeValue = categorical.values.filter(x => x.source.roles.point2Latitude)[0];
    const point2LongitudeValue = categorical.values.filter(x => x.source.roles.point2Longitude)[0];
    const geometryIdValues = geometryIdValue.values;
    const scatterRadiusValue = categorical.values.filter(x => x.source.roles.scatterRadius)[0];
    const polygonExtrudeElevationValue = categorical.values.filter(x => x.source.roles.polygonExtrudeElevation)[0];

    const wkpValues = wkp ? wkp.values : null;
    const wktValues = wkt ? wkt.values : null;
    const point1LatitudeValues = point1LatitudeValue ? point1LatitudeValue.values : null;
    const point1LongitudeValues = point1LongitudeValue ? point1LongitudeValue.values : null;
    const point2LatitudeValues = point2LatitudeValue ? point2LatitudeValue.values : null;
    const point2LongitudeValues = point2LongitudeValue ? point2LongitudeValue.values : null;
    const geometryTypeValues = geometryTypeValue.values;

    // Attributes:
    const scatterLineColorValue = categorical.values.filter(x => x.source.roles.scatterLineColor)[0];
    const scatterLineWidthValue = categorical.values.filter(x => x.source.roles.scatterLineWidth)[0];
    const scatterFillColorValue = categorical.values.filter(x => x.source.roles.scatterFillColor)[0];
    const lineLineWidthValue = categorical.values.filter(x => x.source.roles.lineLineWidth)[0];
    const lineLineColorValue = categorical.values.filter(x => x.source.roles.lineLineColor)[0];
    const pathWidthValue = categorical.values.filter(x => x.source.roles.pathWidth)[0];
    const pathColorValue = categorical.values.filter(x => x.source.roles.pathColor)[0];
    const polygonLineColorValue = categorical.values.filter(x => x.source.roles.polygonLineColor)[0];
    const polygonLineWidthValue = categorical.values.filter(x => x.source.roles.polygonLineWidth)[0];
    const polygonFillColorValue = categorical.values.filter(x => x.source.roles.polygonFillColor)[0];
    const arcLineWidthValue = categorical.values.filter(x => x.source.roles.arcLineWidth)[0];
    const arcSourceColorValue = categorical.values.filter(x => x.source.roles.arcSourceColor)[0];
    const arcTargetColorValue = categorical.values.filter(x => x.source.roles.arcTargetColor)[0];
    const tooltipValue = categorical.values.filter(x => x.source.roles.tooltipHtml)[0];

    const errorMessages = [];
    const scatterString = settings.scatter.geometryType.value.trim().toLowerCase();
    const lineString = settings.line.geometryType.value.trim().toLowerCase();
    const arcString = settings.arc.geometryType.value.trim().toLowerCase();
    const pathString = settings.path.geometryType.value.trim().toLowerCase();
    const polygonString = settings.polygon.geometryType.value.trim().toLowerCase();
    for (let i = 0, len = geometryIdValues.length; i < len; i++) {
        const selectionId: ISelectionId = host.createSelectionIdBuilder().withCategory(geometryIdValue, i).createSelectionId();
        const geometryId = geometryIdValue.values[i].toString();
        const tooltipHtml = tooltipValue ? tooltipValue.values[i] : null;
        const geomType = geometryTypeValues ? geometryTypeValues[i].toString().trim().toLowerCase() : null;
        const data: OurData = {
            id: geometryId,
            type: null,
            lineData: null, lineProperties: null,
            scatterData: null, scatterProperties: null,
            arcData: null, arcProperties: null,
            pathData: null, pathProperties: null,
            polygonData: null, polygonProperties: null,
            selectionId: selectionId,
            tooltipHtml: tooltipHtml ? tooltipHtml.toString() : null
        };
        if (geomType === scatterString) {
            // TODO: check for wkt/wkp geometry if point1 not supplied.
            if (!point1LatitudeValues || !point1LongitudeValues) {
                errorMessages.push(`Geometry ${geometryId}: invalid point coordinates`);
                continue;
            }
            const lat = parseFloat(point1LatitudeValues[i].toString()); // why not user number
            const lon = parseFloat(point1LongitudeValues[i].toString());
            if (!validLat(lat) || !validLon(lon)) {
                errorMessages.push(`Geometry ${geometryId}: invalid point coordinates (lat or lon out of range)`);
                continue;
            }
            if (lat === null || lon === null) {
                errorMessages.push(`Geometry ${geometryId}: one or more point coordinates parse to null`);
                continue;
            }
            data.type = InputGeometryType.Scatter;
            data.scatterData = { lat: lat, lon: lon, radius: getNumberFromValue(scatterRadiusValue, i) };
            data.scatterProperties = {
                lineWidth: getNumberFromValue(scatterLineWidthValue, i),
                lineColor: scatterLineColorValue && scatterLineColorValue.values[i] ? scatterLineColorValue.values[i].toString() : null,
                fillColor: scatterFillColorValue && scatterFillColorValue.values[i] ? scatterFillColorValue.values[i].toString() : null,
            };
        } else if (geomType === lineString || geomType === arcString) {
            // TODO: check for wkt/wkp geometry if point1 not supplied.
            if (!point1LatitudeValues || !point1LongitudeValues || !point2LatitudeValues || !point2LongitudeValues) {
                errorMessages.push(`Geometry ${geometryId}: invalid line/arc coordinates (need point1 and point2 lat and lon)`);
                continue;
            }
            const lat1 = parseFloat(point1LatitudeValues[i].toString()); // why not user number
            const lon1 = parseFloat(point1LongitudeValues[i].toString());
            const lat2 = parseFloat(point2LatitudeValues[i].toString());
            const lon2 = parseFloat(point2LongitudeValues[i].toString());
            if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) {
                errorMessages.push(`Geometry ${geometryId}: invalid line/arc coordinates (one or more point coordinates parse to null)`);
                continue;
            }
            if (!validLat(lat1) || !validLon(lon1) || !validLat(lat2) || !validLon(lon2)) {
                errorMessages.push(`Geometry ${geometryId}: invalid line/arc coordinates (lat or lon out of range)`);
                continue;
            }
            const lineData = { point1: { lat: lat1, lon: lon1 }, point2: { lat: lat2, lon: lon2 } };
            if (geomType === lineString) {
                data.type = InputGeometryType.Line;
                data.lineData = lineData;
                data.lineProperties = {
                    lineWidth: getNumberFromValue(lineLineWidthValue, i),
                    lineColor: lineLineColorValue && lineLineColorValue.values[i] ? lineLineColorValue.values[i].toString() : null,
                };
            } else if (geomType === arcString) {
                data.type = InputGeometryType.Arc;
                data.arcData = lineData;
                data.arcProperties = {
                    lineWidth: getNumberFromValue(arcLineWidthValue, i),
                    sourceColor: arcSourceColorValue && arcSourceColorValue.values[i] ? arcSourceColorValue.values[i].toString() : null,
                    targetColor: arcTargetColorValue && arcTargetColorValue.values[i] ? arcTargetColorValue.values[i].toString() : null,
                };
            }
        } else if (geomType === pathString) {
            if (!wkpValues && !wktValues) {
                errorMessages.push(`Geometry ${geometryId} is a line but is missing WKT/WKP. Specify either WKT/WKP.`);
                continue;
            }
            let value = null;
            let isWkt = false;
            if (wkpValues && wkpValues[i] !== null) {
                value = wkpValues[i];
                isWkt = false;
            } else if (wktValues && wktValues[i] !== null) {
                value = wktValues[i];
                isWkt = true;
            }
            if (value === null) {
                errorMessages.push(`Geometry ${geometryId} is a line but has null line coordinates. Specify either encoded line coordinates or WKT line coordinates.`);
                continue;
            }
            let lineString: number[][] = [];
            if (isWkt) {
                // Use WKT coordinates:
                const wkt = value.toString();
                try {
                    const geojson = parseSync(wkt, WKTLoader);
                    if (!geojson) {
                        errorMessages.push(`Geometry ${geometryId}: invalid WKT line coordinates.`);
                        continue;
                    }
                    if (geojson.type === 'LineString' && geojson.coordinates) {
                        lineString = geojson.coordinates as number[][];
                    } else {
                        errorMessages.push(`Geometry ${geometryId}: WKT geometry must be LineString but was a ${geojson.type}.`);
                        continue;
                    }
                } catch (error) {
                    errorMessages.push(`Geometry ${geometryId}: invalid WKT line coordinates.`);
                }
            } else {
                try {
                    const geom = decode(value.toString());
                    if (geom.geometry.type != "LineString") {
                        errorMessages.push(`Geometry ${geometryId}: encoded geometry must be LineString but was a ${geom.geometry.type}.`);
                        continue;
                    }
                    // Check it's number[][]:
                    if (!Array.isArray(geom.geometry.coordinates) || geom.geometry.coordinates.length == 0 || !Array.isArray(geom.geometry.coordinates[0])) {
                        errorMessages.push(`Geometry ${geometryId}: encoded geometry must be number[][] coordinates.`);
                        continue;
                    }
                    lineString = geom.geometry.coordinates as number[][];
                } catch (error) {
                    errorMessages.push(`Geometry ${geometryId}: invalid encoded line coordinates.`);
                    continue;
                }
            }

            if (lineString.some(c => c.length < 2 || !validLon(c[0]) || !validLat(c[1]))) {
                errorMessages.push(`Geometry ${geometryId}: invalid line coordinates (one or more coordinates out of range)`);
                continue;
            }

            if (lineString.length === 0) {
                errorMessages.push(`Geometry ${geometryId}: no linestrings found.`);
                continue;
            }
            data.type = InputGeometryType.Path;
            data.pathData = { coordinates: lineString.map(x => ({ lon: x[0], lat: x[1] })) };
            data.pathProperties = {
                lineWidth: getNumberFromValue(pathWidthValue, i),
                lineColor: pathColorValue && pathColorValue.values[i] ? pathColorValue.values[i].toString() : null,
            };
            dataPoints.push(data);

        } else if (geomType === polygonString) {
            if (!wkpValues && !wktValues) {
                errorMessages.push(`Geometry ${geometryId} is a polygon but is missing WKT/WKP. Specify either WKT/WKP.`);
                continue;
            }
            let value = null;
            let isWkt = false;
            if (wkpValues && wkpValues[i] !== null) {
                value = wkpValues[i];
                isWkt = false;
            } else if (wktValues && wktValues[i] !== null) {
                value = wktValues[i];
                isWkt = true;
            }
            if (value === null) {
                errorMessages.push(`Geometry ${geometryId} is a line/polygon but has null WKT/WKP coordinates. Specify either WKT/WKP.`);
                continue;
            }
            let rings: number[][][] = [];
            if (isWkt) {
                // Use WKT coordinates:
                const wkt = value.toString();
                try {
                    const geojson = parseSync(wkt, WKTLoader);
                    if (!geojson) {
                        errorMessages.push(`Geometry ${geometryId}: invalid WKT line coordinates.`);
                        continue;
                    } if (geojson.type === 'Polygon' && geojson.coordinates) {
                        rings = geojson.coordinates as number[][][];
                    } else {
                        errorMessages.push(`Geometry ${geometryId}: WKT geometry must be Polygon but was a ${geojson.type}.`);
                        continue;
                    }
                } catch (error) {
                    errorMessages.push(`Geometry ${geometryId}: invalid WKT polygon coordinates.`);
                }
            } else {
                try {
                    const geom = decode(value.toString());
                    if (geom.geometry.type != "Polygon") {
                        errorMessages.push(`Geometry ${geometryId}: encoded geometry must be Polygon but was a ${geom.geometry.type}.`);
                        continue;
                    }
                    // Check it's number[][][]:
                    if (!Array.isArray(geom.geometry.coordinates) || geom.geometry.coordinates.length == 0 || !Array.isArray(geom.geometry.coordinates[0]) || !Array.isArray(geom.geometry.coordinates[0][0])) {
                        errorMessages.push(`Geometry ${geometryId}: encoded geometry must be number[][][] coordinates.`);
                        continue;
                    }
                    rings = geom.geometry.coordinates as number[][][];
                } catch (error) {
                    errorMessages.push(`Geometry ${geometryId}: invalid encoded polygon coordinates.`);
                    continue;
                }
            }


            if (rings.some(ring => ring.some(c => c.length < 2 || !validLon(c[0]) || !validLat(c[1])))) {
                errorMessages.push(`Geometry ${geometryId}: invalid polygon coordinates (one or more coordinates out of range)`);
                continue;
            }

            if (rings.length === 0) {
                errorMessages.push(`Geometry ${geometryId}: no rings found.`);
                continue;
            }

            data.type = InputGeometryType.Polygon;
            data.polygonData = { rings: rings.map(ring => ({ coordinates: ring.map(x => ({ lon: x[0], lat: x[1] })) })) };
            data.polygonProperties = {
                lineWidth: getNumberFromValue(polygonLineWidthValue, i),
                lineColor: polygonLineColorValue && polygonLineColorValue.values[i] ? polygonLineColorValue.values[i].toString() : null,
                fillColor: polygonFillColorValue && polygonFillColorValue.values[i] ? polygonFillColorValue.values[i].toString() : null,
                elevation: getNumberFromValue(polygonExtrudeElevationValue, i),
            };

        } else {
            errorMessages.push(`Geometry ${geometryId}: invalid geometry type`);
            continue;
        }

        // Bail if no geometry defined:
        if (data.type === null) {
            continue;
        }

        dataPoints.push(data);
    }

    if (host && errorMessages.length > 0) {
        host.displayWarningIcon('Data parsing error.', errorMessages.slice(0, 10).join('\n').slice(0, 500));
    }

    return dataPoints;
}