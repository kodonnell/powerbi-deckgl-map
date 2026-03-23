import { GeoJsonLayer } from '@deck.gl/layers';
import { InputLayerType, OurData } from '../dataTypes';
import { withOpacity, decodeHex } from '../col';
import { HighlightingCardSettings, PolygonCardSettings } from '../settings';
import { getLayerColor } from './col';

export default function getPolygonLayer(dataPoints: OurData[], settings: PolygonCardSettings, highlighting: HighlightingCardSettings, selectedIds: Set<string>, onClick: (info: any, event: any) => void) {
    const defaultLineColor = withOpacity(decodeHex(settings.line.color.defaultLineColor.value.value, [0, 0, 0, 100]), settings.line.color.defaultLineOpacity.value);
    const defaultFillColor = withOpacity(decodeHex(settings.fill.defaultFillColor.value.value, [0, 0, 0, 100]), settings.fill.defaultFillOpacity.value);
    const fadeFactor = Math.max(0, Math.min(1, highlighting.unselectedFadeOpacity.value / 100)); // convert percentage to 0-1 range and clamp
    const shouldFadeUnselected = highlighting.highlightOnClick.value && selectedIds.size > 0;
    const autoHighlightColor = withOpacity(decodeHex(highlighting.autoHighlightColor.value.value, [255, 153, 0, 255]), highlighting.autoHighlightOpacity.value);

    const featureCollection = dataPoints.filter(x => x.type === InputLayerType.Polygon).map(d => ({
        type: "Feature" as const,
        geometry: d.polygonData,
        properties: d.polygonProperties,
        selectionId: d.selectionId,
        tooltipHtml: d.tooltipHtml,
        id: d.id
    }));

    return new GeoJsonLayer({
        id: `polygon-layer-base`,
        data: featureCollection,
        pickable: true,
        stroked: settings.stroked.value,
        getLineColor: d => getLayerColor(d.properties?.lineColor, defaultLineColor, shouldFadeUnselected, fadeFactor, selectedIds, String(d.id)),
        getLineWidth: d => {
            const w = d.properties?.lineWidth;
            if (typeof w === "number" && isFinite(w) && w > 0) {
                return w;
            }
            return settings.line.width.defaultLineWidth.value;
        },
        lineWidthMinPixels: settings.line.width.lineWidthMinPixels.value,
        lineWidthMaxPixels: settings.line.width.lineWidthMaxPixels.value,
        filled: settings.filled.value,
        getFillColor: d => getLayerColor(d.properties?.fillColor, defaultFillColor, shouldFadeUnselected, fadeFactor, selectedIds, String(d.id)),
        extruded: settings.extruded.value,
        getElevation: d => d.properties?.elevation,
        wireframe: settings.wireframe.value,
        lineJointRounded: settings.path.lineJointRounded.value,
        lineMiterLimit: settings.path.lineMiterLimit.value,
        autoHighlight: highlighting.autoHighlight.value,
        highlightColor: autoHighlightColor,
        onClick: (info, event) => onClick(info, event),
        updateTriggers: {
            getLineWidth: [settings.line.width.defaultLineWidth.value, selectedIds],
            getLineColor: [settings.line.color.defaultLineColor.value.value, settings.line.color.defaultLineOpacity.value, highlighting.highlightOnClick.value, highlighting.unselectedFadeOpacity.value, selectedIds],
            getFillColor: [settings.fill.defaultFillColor.value.value, settings.fill.defaultFillOpacity.value, highlighting.highlightOnClick.value, highlighting.unselectedFadeOpacity.value, selectedIds],
            getCapRounded: [settings.path.lineCapRounded.value],
            getJointRounded: [settings.path.lineJointRounded.value],
            getMiterLimit: [settings.path.lineMiterLimit.value],
            getBillboard: [settings.billboard.billboard.value],
            highlightColor: [highlighting.autoHighlightColor.value.value, highlighting.autoHighlightOpacity.value],
        },
    });
};