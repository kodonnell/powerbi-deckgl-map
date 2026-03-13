import { LineLayer } from '@deck.gl/layers';
import { InputLayerType, OurData } from '../dataTypes';
import { withOpacity, decodeHex } from '../col';
import { HighlightingCardSettings, LineCardSettings } from '../settings';

export default function getLineLayer(highlights: boolean, dataPoints: OurData[], settings: LineCardSettings, highlighting: HighlightingCardSettings, selectedIds: string[], onClick: (info: any, event: any) => void) {
    const defaultLineColor = withOpacity(decodeHex(settings.line.color.defaultLineColor.value.value, [0, 0, 0, 100]), settings.line.color.defaultLineOpacity.value);
    let data = dataPoints.filter(x => x.type === InputLayerType.Line);
    if (highlights) {
        data = data.filter(x => selectedIds.includes(x.id));
    }
    const scale = highlights ? highlighting.highlightSizeScale.value : 1.0;
    const selectedHighlightColor = withOpacity(decodeHex(highlighting.highlightColor.value.value, [255, 0, 0, 255]), highlighting.highlightOpacity.value);
    const autoHighlightColor = withOpacity(decodeHex(highlighting.autoHighlightColor.value.value, [255, 153, 0, 255]), highlighting.autoHighlightOpacity.value);

    return new LineLayer<OurData>({
        id: `line-layer-${highlights}`,
        data: data,
        pickable: true,
        getSourcePosition: d => [d.lineData!.point1.lon, d.lineData!.point1.lat, highlights ? 0 : 0.1], // Slightly offset highlighted points to avoid z-fighting
        getTargetPosition: d => [d.lineData!.point2.lon, d.lineData!.point2.lat, highlights ? 0 : 0.1], // Slightly offset highlighted points to avoid z-fighting
        getWidth: d => {
            const w = d.lineProperties?.lineWidth;
            if (typeof w === "number" && isFinite(w) && w > 0) {
                return w * scale;
            }
            return settings.line.width.defaultLineWidth.value * scale;
        },
        getColor: d => highlights ? selectedHighlightColor : decodeHex(d.lineProperties?.lineColor, defaultLineColor),
        widthMinPixels: settings.line.width.lineWidthMinPixels.value * scale,
        widthMaxPixels: settings.line.width.lineWidthMaxPixels.value * scale,
        autoHighlight: highlighting.autoHighlight.value,
        highlightColor: autoHighlightColor,
        onClick: (info, event) => onClick(info, event),
        updateTriggers: {
            getWidth: [settings.line.width.defaultLineWidth.value, highlighting.highlightSizeScale.value, selectedIds],
            getColor: [settings.line.color.defaultLineColor.value.value, settings.line.color.defaultLineOpacity.value, highlighting.highlightColor.value.value, highlighting.highlightOpacity.value, selectedIds],
            highlightColor: [highlighting.autoHighlightColor.value.value, highlighting.autoHighlightOpacity.value],
        },
    });
};