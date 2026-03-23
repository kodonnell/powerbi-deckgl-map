import { GeoJsonLayer } from '@deck.gl/layers';
import { InputLayerType, OurData } from '../dataTypes';
import { withOpacity, decodeHex } from '../col';
import { HighlightingCardSettings, PathCardSettings } from '../settings';
import { getLayerColor } from './col';

export default function getPathLayer(dataPoints: OurData[], settings: PathCardSettings, highlighting: HighlightingCardSettings, selectedIds: Set<string>, onClick: (info: any, event: any) => void) {
    const defaultLineColor = withOpacity(decodeHex(settings.line.color.defaultLineColor.value.value, [0, 0, 0, 100]), settings.line.color.defaultLineOpacity.value);
    const fadeFactor = Math.max(0, Math.min(1, highlighting.unselectedFadeOpacity.value / 100));
    const shouldFadeUnselected = highlighting.highlightOnClick.value && selectedIds.size > 0;
    const autoHighlightColor = withOpacity(decodeHex(highlighting.autoHighlightColor.value.value, [255, 153, 0, 255]), highlighting.autoHighlightOpacity.value);
    const data = dataPoints.filter(x => x.type === InputLayerType.Path);

    const featureCollection = data.map(d => ({
        type: "Feature" as const,
        geometry: d.pathData,
        properties: d.pathProperties,
        selectionId: d.selectionId,
        tooltipHtml: d.tooltipHtml,
        id: d.id
    }));


    return new GeoJsonLayer({
        id: `path-layer-base`,
        data: featureCollection,
        pickable: true,
        getLineWidth: d => {
            const w = d.properties?.lineWidth;
            if (typeof w === "number" && isFinite(w) && w > 0) {
                return w;
            }
            return settings.line.width.defaultLineWidth.value;
        },
        getLineColor: d => getLayerColor(d.properties?.lineColor, defaultLineColor, shouldFadeUnselected, fadeFactor, selectedIds, String(d.id)),
        lineWidthMinPixels: settings.line.width.lineWidthMinPixels.value,
        lineWidthMaxPixels: settings.line.width.lineWidthMaxPixels.value,
        lineCapRounded: settings.path.lineCapRounded.value,
        lineJointRounded: settings.path.lineJointRounded.value,
        lineMiterLimit: settings.path.lineMiterLimit.value,
        lineBillboard: settings.billboard.billboard.value,
        autoHighlight: highlighting.autoHighlight.value,
        highlightColor: autoHighlightColor,
        onClick: (info, event) => onClick(info, event),
        updateTriggers: {
            getLineWidth: [settings.line.width.defaultLineWidth.value, selectedIds],
            getLineColor: [settings.line.color.defaultLineColor.value.value, settings.line.color.defaultLineOpacity.value, highlighting.highlightOnClick.value, highlighting.unselectedFadeOpacity.value, selectedIds],
            getLineCapRounded: [settings.path.lineCapRounded.value],
            getLineJointRounded: [settings.path.lineJointRounded.value],
            getLineMiterLimit: [settings.path.lineMiterLimit.value],
            getLineBillboard: [settings.billboard.billboard.value],
            highlightColor: [highlighting.autoHighlightColor.value.value, highlighting.autoHighlightOpacity.value],
        },
    });
};