import { ArcLayer } from '@deck.gl/layers';
import { InputLayerType, OurData } from '../dataTypes';
import { withOpacity, decodeHex } from '../col';
import { ArcCardSettings, HighlightingCardSettings } from '../settings';
export default function getArcLayer(highlights: boolean, dataPoints: OurData[], settings: ArcCardSettings, highlighting: HighlightingCardSettings, selectedIds: string[], onClick: (info: any, event: any) => void) {

    const defaultSourceColor = withOpacity(decodeHex(settings.defaultSourceColor.value.value, [0, 0, 0, 100]), settings.defaultSourceOpacity.value);
    const defaultTargetColor = withOpacity(decodeHex(settings.defaultTargetColor.value.value, [0, 0, 0, 100]), settings.defaultTargetOpacity.value);
    let data = dataPoints.filter(x => x.type === InputLayerType.Arc);
    if (highlights) {
        data = data.filter(x => selectedIds.includes(x.id));
    }
    const scale = highlights ? highlighting.highlightSizeScale.value : 1.0;
    const selectedHighlightColor = withOpacity(decodeHex(highlighting.highlightColor.value.value, [255, 0, 0, 255]), highlighting.highlightOpacity.value);
    const autoHighlightColor = withOpacity(decodeHex(highlighting.autoHighlightColor.value.value, [255, 153, 0, 255]), highlighting.autoHighlightOpacity.value);

    return new ArcLayer<OurData>({
        id: `arc-layer-${highlights}`,
        data: data,
        pickable: true,
        getSourcePosition: d => [d.arcData!.point1.lon, d.arcData!.point1.lat],
        getTargetPosition: d => [d.arcData!.point2.lon, d.arcData!.point2.lat],
        getWidth: d => {
            const w = d.arcProperties?.lineWidth;
            if (typeof w === "number" && isFinite(w) && w > 0) {
                return w * scale;
            }
            return settings.strokeWidth.defaultLineWidth.value * scale;
        },
        getSourceColor: d => highlights ? selectedHighlightColor : decodeHex(d.arcProperties?.sourceColor, defaultSourceColor),
        getTargetColor: d => highlights ? selectedHighlightColor : decodeHex(d.arcProperties?.targetColor, defaultTargetColor),
        widthMinPixels: settings.strokeWidth.lineWidthMinPixels.value * scale,
        widthMaxPixels: settings.strokeWidth.lineWidthMaxPixels.value * scale,
        autoHighlight: highlighting.autoHighlight.value,
        highlightColor: autoHighlightColor,
        onClick: (info, event) => onClick(info, event),
        updateTriggers: {
            getWidth: [settings.strokeWidth.defaultLineWidth.value, highlighting.highlightSizeScale.value, selectedIds],
            getSourceColor: [settings.defaultSourceColor.value.value, settings.defaultSourceOpacity.value, highlighting.highlightColor.value.value, highlighting.highlightOpacity.value, selectedIds],
            getTargetColor: [settings.defaultTargetColor.value.value, settings.defaultTargetOpacity.value, highlighting.highlightColor.value.value, highlighting.highlightOpacity.value, selectedIds],
            highlightColor: [highlighting.autoHighlightColor.value.value, highlighting.autoHighlightOpacity.value],
        },
    });
};