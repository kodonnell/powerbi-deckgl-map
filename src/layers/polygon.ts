import { GeoJsonLayer } from '@deck.gl/layers';
import { InputLayerType, OurData } from '../dataTypes';
import { withOpacity, decodeHex } from '../col';
import { HighlightingCardSettings, PolygonCardSettings } from '../settings';

export default function getPolygonLayer(highlights: boolean, dataPoints: OurData[], settings: PolygonCardSettings, highlighting: HighlightingCardSettings, selectedIds: string[], onClick: (info: any, event: any) => void) {
    const defaultLineColor = withOpacity(decodeHex(settings.line.color.defaultLineColor.value.value, [0, 0, 0, 100]), settings.line.color.defaultLineOpacity.value);
    const defaultFillColor = withOpacity(decodeHex(settings.fill.defaultFillColor.value.value, [0, 0, 0, 100]), settings.fill.defaultFillOpacity.value);
    let data = dataPoints.filter(x => x.type === InputLayerType.Polygon);
    if (highlights) {
        data = data.filter(x => selectedIds.includes(x.id));
    }
    const scale = highlights ? highlighting.highlightSizeScale.value : 1.0;
    const selectedHighlightColor = withOpacity(decodeHex(highlighting.highlightColor.value.value, [255, 0, 0, 255]), highlighting.highlightOpacity.value);
    const autoHighlightColor = withOpacity(decodeHex(highlighting.autoHighlightColor.value.value, [255, 153, 0, 255]), highlighting.autoHighlightOpacity.value);

    const featureCollection = data.map(d => ({
        type: "Feature" as const,
        geometry: d.polygonData,
        properties: d.polygonProperties,
        selectionId: d.selectionId,
        id: d.id
    }));

    return new GeoJsonLayer({
        id: `polygon-layer-${highlights}`,
        data: featureCollection,
        pickable: true,
        // getPolygon: d => d.polygonData?.rings ? d.polygonData.rings.map(ring => ring.coordinates.map(c => [c.lon, c.lat, highlights ? 0 : 0.1])) : [], // TODO: offset doesn't seem to work?
        stroked: settings.stroked.value,
        // positionFormat: "XYZ",
        getLineColor: d => highlights ? selectedHighlightColor : decodeHex(d.properties?.lineColor, defaultLineColor),
        getLineWidth: d => {
            const w = d.properties?.lineWidth;
            if (typeof w === "number" && isFinite(w) && w > 0) {
                return w * scale;
            }
            return settings.line.width.defaultLineWidth.value * scale;
        },
        lineWidthMinPixels: settings.line.width.lineWidthMinPixels.value * scale,
        lineWidthMaxPixels: settings.line.width.lineWidthMaxPixels.value * scale,
        filled: settings.filled.value,
        getFillColor: d => highlights ? selectedHighlightColor : decodeHex(d.properties?.fillColor, defaultFillColor),
        extruded: settings.extruded.value,
        getElevation: d => d.properties?.elevation,
        wireframe: settings.wireframe.value,
        lineJointRounded: settings.path.lineJointRounded.value,
        lineMiterLimit: settings.path.lineMiterLimit.value,
        autoHighlight: highlighting.autoHighlight.value,
        highlightColor: autoHighlightColor,
        onClick: (info, event) => onClick(info, event),
        updateTriggers: {
            getLineWidth: [settings.line.width.defaultLineWidth.value, highlighting.highlightSizeScale.value, selectedIds],
            getLineColor: [settings.line.color.defaultLineColor.value.value, settings.line.color.defaultLineOpacity.value, highlighting.highlightColor.value.value, highlighting.highlightOpacity.value, selectedIds],
            getFillColor: [settings.fill.defaultFillColor.value.value, settings.fill.defaultFillOpacity.value, highlighting.highlightColor.value.value, highlighting.highlightOpacity.value, selectedIds],
            getCapRounded: [settings.path.lineCapRounded.value],
            getJointRounded: [settings.path.lineJointRounded.value],
            getMiterLimit: [settings.path.lineMiterLimit.value],
            getBillboard: [settings.billboard.billboard.value],
            highlightColor: [highlighting.autoHighlightColor.value.value, highlighting.autoHighlightOpacity.value],
        },
    });
};