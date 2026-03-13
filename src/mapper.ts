
import powerbi from "powerbi-visuals-api";
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import ISelectionId = powerbi.visuals.ISelectionId;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import { decodeAsGeometry } from "./encoding";
import { InputLayerType, LineData, OurData, RowValues } from "./dataTypes";
import { VisualFormattingSettingsModel } from "./settings";
import { WKTLoader } from '@loaders.gl/wkt';
import { parseSync } from '@loaders.gl/core';
import { Geometry, Polygon, MultiPolygon } from 'geojson';
import { parsePath } from "./parsers/path";
import { getNumberFromValue } from "./powerbiUtils";

const validLat = (lat: number): boolean => {
    return isFinite(lat) && lat >= -90 && lat <= 90;
}
const validLon = (lon: number): boolean => {
    return isFinite(lon) && lon >= -180 && lon <= 180;
}
const parseScatter = (isProvided: RowValues, rowValues: RowValues, errorMessages: string[], data: OurData): boolean => {
    if (!isProvided.point1Latitude || !isProvided.point1Longitude || rowValues.point1Latitude === null || rowValues.point1Longitude === null) {
        errorMessages.push(`Geometry ${rowValues.geometryId}: invalid point coordinates`);
        return false;
    }
    const lat = parseFloat(rowValues.point1Latitude.toString()); // why not user number
    const lon = parseFloat(rowValues.point1Longitude.toString());
    if (!validLat(lat) || !validLon(lon)) {
        errorMessages.push(`Geometry ${rowValues.geometryId}: invalid point coordinates (lat or lon out of range)`);
        return false;
    }
    if (lat === null || lon === null) {
        errorMessages.push(`Geometry ${rowValues.geometryId}: one or more point coordinates parse to null`);
        return false;
    }
    data.type = InputLayerType.Scatter;
    data.scatterData = { lat: lat, lon: lon, radius: getNumberFromValue(rowValues.scatterRadius) };
    data.scatterProperties = {
        lineWidth: getNumberFromValue(rowValues.scatterLineWidth),
        lineColor: rowValues.scatterLineColor?.toString(),
        fillColor: rowValues.scatterFillColor?.toString(),
    };
    return true;
}

const parseLineArcGeometry = (isProvided: RowValues, rowValues: RowValues, errorMessages: string[]): [boolean, LineData | null] => {
    if (!isProvided.point1Latitude || !isProvided.point1Longitude || !isProvided.point2Latitude || !isProvided.point2Longitude
        || rowValues.point1Latitude === null || rowValues.point1Longitude === null || rowValues.point2Latitude === null || rowValues.point2Longitude === null) {
        errorMessages.push(`Geometry ${rowValues.geometryId}: invalid line/arc coordinates (need point1 and point2 lat and lon)`);
        return [false, null];
    }
    const lat1 = parseFloat(rowValues.point1Latitude.toString()); // why not user number
    const lon1 = parseFloat(rowValues.point1Longitude.toString());
    const lat2 = parseFloat(rowValues.point2Latitude.toString());
    const lon2 = parseFloat(rowValues.point2Longitude.toString());
    if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) {
        errorMessages.push(`Geometry ${rowValues.geometryId}: invalid line/arc coordinates (one or more point coordinates parse to null)`);
        return [false, null];
    }
    if (!validLat(lat1) || !validLon(lon1) || !validLat(lat2) || !validLon(lon2)) {
        errorMessages.push(`Geometry ${rowValues.geometryId}: invalid line/arc coordinates (lat or lon out of range)`);
        return [false, null];
    }
    const lineData: LineData = {
        point1: { lat: lat1, lon: lon1 },
        point2: { lat: lat2, lon: lon2 },
    };
    return [true, lineData];
}

const parseLine = (isProvided: RowValues, rowValues: RowValues, errorMessages: string[], data: OurData): boolean => {
    const [ok, geometryParsed] = parseLineArcGeometry(isProvided, rowValues, errorMessages);
    if (!ok || !geometryParsed) {
        return false;
    }
    data.type = InputLayerType.Line;
    data.lineData = geometryParsed;
    data.lineProperties = {
        lineWidth: getNumberFromValue(rowValues.lineLineWidth),
        lineColor: rowValues.lineLineColor?.toString(),
    };
    return true;
}

const parseArc = (isProvided: RowValues, rowValues: RowValues, errorMessages: string[], data: OurData): boolean => {
    const [ok, geometryParsed] = parseLineArcGeometry(isProvided, rowValues, errorMessages);
    if (!ok || !geometryParsed) {
        return false;
    }
    data.type = InputLayerType.Arc;
    data.arcData = geometryParsed;
    data.arcProperties = {
        lineWidth: getNumberFromValue(rowValues.arcLineWidth),
        sourceColor: rowValues.arcSourceColor?.toString(),
        targetColor: rowValues.arcTargetColor?.toString(),
    };
    return true;
}

const parseWkt = (wkt: string, geometryId: any, errorMessages: string[]): Geometry | null => {
    if (!wkt || wkt.trim() === "") {
        return null;
    }
    try {
        const geojson = parseSync(wkt, WKTLoader);
        if (!geojson) {
            errorMessages.push(`Geometry ${geometryId}: invalid WKT geometry.`);
            return null;
        }
        return geojson as Geometry;
    } catch (error) {
        errorMessages.push(`Geometry ${geometryId}: invalid WKT geometry.`);
        return null;
    }
}

const parseWkp = (wkp: string, geometryId: any, errorMessages: string[]): Geometry | null => {
    if (!wkp) {
        return null;
    }
    try {
        const geom = decodeAsGeometry(wkp);
        if (geometryId === 'path-02152a887c290ecc491c8a276ba82367') {
            console.log(wkp);
            console.log(geom);
        }
        if (!geom) {
            errorMessages.push(`Geometry ${geometryId}: invalid encoded geometry.`);
            return null;
        }
        return geom;
    } catch (error) {
        errorMessages.push(`Geometry ${geometryId}: failed to decode WKP: ${error}`);
        return null;
    }
}

const parsePolygon = (wktGeometry: Geometry, wkpGeometry: Geometry, rowValues: RowValues, errorMessages: string[], data: OurData): boolean => {
    let geometry: Polygon | MultiPolygon | null = null;
    const id = rowValues.geometryId;
    if (wktGeometry) {
        if (wktGeometry.type === 'Polygon') {
            if (wktGeometry.coordinates.length === 0 || !Array.isArray(wktGeometry.coordinates[0]) || !Array.isArray(wktGeometry.coordinates[0][0])) {
                errorMessages.push(`Geometry ${id}: invalid WKT polygon coordinates.`);
                return false;
            }
            geometry = wktGeometry;
        } else if (wktGeometry.type === 'MultiPolygon') {
            if (wktGeometry.coordinates.length === 0 || !Array.isArray(wktGeometry.coordinates[0]) || !Array.isArray(wktGeometry.coordinates[0][0]) || !Array.isArray(wktGeometry.coordinates[0][0][0])) {
                errorMessages.push(`Geometry ${id}: invalid WKT multipolygon coordinates.`);
                return false;
            }
            geometry = wktGeometry;
        } else {
            errorMessages.push(`Geometry ${id}: WKT geometry is not a polygon or multipolygon.`);
            return false;
        }
    } else if (wkpGeometry) {
        if (wkpGeometry.type === 'Polygon') {
            if (wkpGeometry.coordinates.length === 0 || !Array.isArray(wkpGeometry.coordinates[0]) || !Array.isArray(wkpGeometry.coordinates[0][0])) {
                errorMessages.push(`Geometry ${id}: invalid encoded polygon coordinates.`);
                return false;
            }
            geometry = wkpGeometry;
        } else if (wkpGeometry.type === 'MultiPolygon') {
            if (wkpGeometry.coordinates.length === 0 || !Array.isArray(wkpGeometry.coordinates[0]) || !Array.isArray(wkpGeometry.coordinates[0][0]) || !Array.isArray(wkpGeometry.coordinates[0][0][0])) {
                errorMessages.push(`Geometry ${id}: invalid encoded multipolygon coordinates.`);
                return false;
            }
            geometry = wkpGeometry;
        } else {
            errorMessages.push(`Geometry ${id}: encoded geometry is not a polygon or multipolygon.`);
            return false;
        }
    }
    if (!geometry) {
        errorMessages.push(`Geometry ${id} is a polygon but is missing WKT/WKP. Specify either WKT/WKP.`);
        return false;
    }
    data.type = InputLayerType.Polygon;
    data.polygonData = geometry;
    data.polygonProperties = {
        lineWidth: getNumberFromValue(rowValues.polygonLineWidth),
        lineColor: rowValues.polygonLineColor?.toString(),
        fillColor: rowValues.polygonFillColor?.toString(),
        elevation: getNumberFromValue(rowValues.polygonExtrudeElevation),
    };
    return true;
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
    const layerTypeValue = categorical.values.filter(x => x.source.roles.layerType)[0];
    if (!layerTypeValue) {
        return dataPoints;
    }

    const hasAnyDataHighlights = categorical.values.some((valueColumn: any) => {
        const highlights = valueColumn?.highlights;
        return Array.isArray(highlights) && highlights.some((v) => v !== null && v !== undefined);
    });

    const categoricalValues: RowValues = {
        geometryId: geometryIdValue,
        layerType: layerTypeValue,
        wkp: categorical.values.filter(x => x.source.roles.wkp)[0],
        wkt: categorical.values.filter(x => x.source.roles.wkt)[0],
        point1Latitude: categorical.values.filter(x => x.source.roles.point1Latitude)[0],
        point1Longitude: categorical.values.filter(x => x.source.roles.point1Longitude)[0],
        point2Latitude: categorical.values.filter(x => x.source.roles.point2Latitude)[0],
        point2Longitude: categorical.values.filter(x => x.source.roles.point2Longitude)[0],
        scatterRadius: categorical.values.filter(x => x.source.roles.scatterRadius)[0],
        scatterLineColor: categorical.values.filter(x => x.source.roles.scatterLineColor)[0],
        scatterLineWidth: categorical.values.filter(x => x.source.roles.scatterLineWidth)[0],
        scatterFillColor: categorical.values.filter(x => x.source.roles.scatterFillColor)[0],
        lineLineWidth: categorical.values.filter(x => x.source.roles.lineLineWidth)[0],
        lineLineColor: categorical.values.filter(x => x.source.roles.lineLineColor)[0],
        pathWidth: categorical.values.filter(x => x.source.roles.pathWidth)[0],
        pathColor: categorical.values.filter(x => x.source.roles.pathColor)[0],
        polygonLineColor: categorical.values.filter(x => x.source.roles.polygonLineColor)[0],
        polygonLineWidth: categorical.values.filter(x => x.source.roles.polygonLineWidth)[0],
        polygonFillColor: categorical.values.filter(x => x.source.roles.polygonFillColor)[0],
        polygonExtrudeElevation: categorical.values.filter(x => x.source.roles.polygonExtrudeElevation)[0],
        arcLineWidth: categorical.values.filter(x => x.source.roles.arcLineWidth)[0],
        arcSourceColor: categorical.values.filter(x => x.source.roles.arcSourceColor)[0],
        arcTargetColor: categorical.values.filter(x => x.source.roles.arcTargetColor)[0],
        tooltip: categorical.values.filter(x => x.source.roles.tooltipHtml)[0],
    };

    const rowValueArrays: RowValues = Object.fromEntries(
        Object.entries(categoricalValues).map(([key, value]) => [key, value ? value.values : null])
    ) as RowValues;

    const isProvided: RowValues = Object.fromEntries(
        Object.entries(rowValueArrays).map(([key, value]) => [key, !!value as any])
    ) as RowValues;

    const errorMessages = [];
    const scatterString = settings.scatter.layerType.value.trim().toLowerCase();
    const lineString = settings.line.layerType.value.trim().toLowerCase();
    const arcString = settings.arc.layerType.value.trim().toLowerCase();
    const pathString = settings.path.layerType.value.trim().toLowerCase();
    const polygonString = settings.polygon.layerType.value.trim().toLowerCase();

    for (let i = 0, len = rowValueArrays.geometryId.length; i < len; i++) {
        const rowValues: RowValues = Object.fromEntries(
            Object.entries(rowValueArrays).map(([key, value]) => [key, value ? value[i] : null])
        ) as RowValues;
        const id = rowValues.geometryId;
        const selectionId: ISelectionId = host.createSelectionIdBuilder().withCategory(geometryIdValue, i).createSelectionId();
        const geomType = rowValues.layerType ? rowValues.layerType.toString().trim().toLowerCase() : null;
        const wktGeometry = isProvided.wkt ? parseWkt(rowValues.wkt, rowValues.geometryId, errorMessages) : null;
        const wkpGeometry = isProvided.wkp ? parseWkp(rowValues.wkp, rowValues.geometryId, errorMessages) : null;

        const data: OurData = {
            id: rowValues.geometryId,
            type: null,
            lineData: null, lineProperties: null,
            scatterData: null, scatterProperties: null,
            arcData: null, arcProperties: null,
            pathData: null, pathProperties: null,
            polygonData: null, polygonProperties: null,
            isHighlightedFromData: hasAnyDataHighlights && categorical.values.some((valueColumn: any) => {
                const highlights = valueColumn?.highlights;
                return Array.isArray(highlights) && highlights[i] !== null && highlights[i] !== undefined;
            }),
            selectionId: selectionId,
            tooltipHtml: rowValues.tooltip?.toString()
        };
        if (geomType === scatterString) {
            if (!parseScatter(isProvided, rowValues, errorMessages, data)) {
                continue;
            }
        } else if (geomType === lineString) {
            if (!parseLine(isProvided, rowValues, errorMessages, data)) {
                console.log(`Failed to parse line geometry with id ${id}, skipping this geometry.`);
                continue;
            }
        } else if (geomType === arcString) {
            if (!parseArc(isProvided, rowValues, errorMessages, data)) {
                continue;
            }
        } else if (geomType === pathString) {
            if (!parsePath(wktGeometry, wkpGeometry, rowValues, errorMessages, data)) {
                continue;
            }
        } else if (geomType === polygonString) {
            if (!parsePolygon(wktGeometry, wkpGeometry, rowValues, errorMessages, data)) {
                continue;
            }
        } else {
            errorMessages.push(`Geometry ${id}: unknown layer type ${geomType}`);
            continue;
        }

        // Bail if no geometry defined:
        if (data.type === null) {
            errorMessages.push(`Geometry ${id}: no geometry defined. Check that the layer type is correct and that WKT/WKP or point coordinates are provided as needed.`);
            continue;
        }

        dataPoints.push(data);
    }

    if (host && errorMessages.length > 0) {
        host.displayWarningIcon('Data parsing error.', errorMessages.slice(0, 10).join('\n').slice(0, 500));
    }

    return dataPoints;
}