import { GeoJsonLayer } from '@deck.gl/layers';
import { InputLayerType, OurData } from '../dataTypes';
import { withOpacity, decodeHex } from '../col';
import { HighlightingCardSettings, PathCardSettings } from '../settings';

export default function getPathLayer(highlights: boolean, dataPoints: OurData[], settings: PathCardSettings, highlighting: HighlightingCardSettings, selectedIds: string[], onClick: (info: any, event: any) => void) {
    const defaultLineColor = withOpacity(decodeHex(settings.line.color.defaultLineColor.value.value, [0, 0, 0, 100]), settings.line.color.defaultLineOpacity.value);
    let data = dataPoints.filter(x => x.type === InputLayerType.Path);
    if (highlights) {
        data = data.filter(x => selectedIds.includes(x.id));
    }
    const scale = highlights ? highlighting.highlightSizeScale.value : 1.0;
    const selectedHighlightColor = withOpacity(decodeHex(highlighting.highlightColor.value.value, [255, 0, 0, 255]), highlighting.highlightOpacity.value);
    const autoHighlightColor = withOpacity(decodeHex(highlighting.autoHighlightColor.value.value, [255, 153, 0, 255]), highlighting.autoHighlightOpacity.value);

    const featureCollection = data.map(d => ({
        type: "Feature" as const,
        geometry: d.pathData,
        properties: d.pathProperties,
        selectionId: d.selectionId,
        tooltipHtml: d.tooltipHtml,
        id: d.id
    }));


    return new GeoJsonLayer({
        id: `path-layer-${highlights}`,
        data: featureCollection,
        pickable: true,
        getLineWidth: d => {
            const w = d.properties?.lineWidth;
            if (typeof w === "number" && isFinite(w) && w > 0) {
                return w * scale;
            }
            return settings.line.width.defaultLineWidth.value * scale;
        },
        getLineColor: d => highlights ? selectedHighlightColor : decodeHex(d.properties?.lineColor, defaultLineColor),
        lineWidthMinPixels: settings.line.width.lineWidthMinPixels.value * scale,
        lineWidthMaxPixels: settings.line.width.lineWidthMaxPixels.value * scale,
        lineCapRounded: settings.path.lineCapRounded.value,
        lineJointRounded: settings.path.lineJointRounded.value,
        lineMiterLimit: settings.path.lineMiterLimit.value,
        lineBillboard: settings.billboard.billboard.value,
        autoHighlight: highlighting.autoHighlight.value,
        highlightColor: autoHighlightColor,
        onClick: (info, event) => onClick(info, event),
        updateTriggers: {
            getLineWidth: [settings.line.width.defaultLineWidth.value, highlighting.highlightSizeScale.value, selectedIds],
            getLineColor: [settings.line.color.defaultLineColor.value.value, settings.line.color.defaultLineOpacity.value, highlighting.highlightColor.value.value, highlighting.highlightOpacity.value, selectedIds],
            getLineCapRounded: [settings.path.lineCapRounded.value],
            getLineJointRounded: [settings.path.lineJointRounded.value],
            getLineMiterLimit: [settings.path.lineMiterLimit.value],
            getLineBillboard: [settings.billboard.billboard.value],
            highlightColor: [highlighting.autoHighlightColor.value.value, highlighting.autoHighlightOpacity.value],
        },
    });
};