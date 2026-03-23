import { ScatterplotLayer } from '@deck.gl/layers';
import { InputLayerType, OurData } from '../dataTypes';
import { decodeHex, withOpacity } from '../col';
import { HighlightingCardSettings, ScatterCardSettings } from '../settings';
import { getLayerColor } from './col';

export default function getScatterLayer(dataPoints: OurData[], settings: ScatterCardSettings, highlighting: HighlightingCardSettings, selectedIds: Set<string>, onClick: (info: any, event: any) => void) {
    const defaultFillColor = withOpacity(decodeHex(settings.fill.defaultFillColor.value.value, [0, 0, 0, 100]), settings.fill.defaultFillOpacity.value);
    const defaultLineColor = withOpacity(decodeHex(settings.line.color.defaultLineColor.value.value, [0, 0, 0, 100]), settings.line.color.defaultLineOpacity.value);
    const fadeFactor = Math.max(0, Math.min(1, highlighting.unselectedFadeOpacity.value / 100));
    const shouldFadeUnselected = highlighting.highlightOnClick.value && selectedIds.size > 0;
    const autoHighlightColor = withOpacity(decodeHex(highlighting.autoHighlightColor.value.value, [255, 153, 0, 255]), highlighting.autoHighlightOpacity.value);
    const data = dataPoints.filter(x => x.type === InputLayerType.Scatter);

    return new ScatterplotLayer<OurData>({
        id: `scatterplot-layer-base`,
        data: data,
        pickable: true,
        stroked: settings.stroked.value,
        filled: settings.filled.value,
        getPosition: d => [d.scatterData!.lon, d.scatterData!.lat, 0.1],
        getLineWidth: d => {
            const w = d.scatterProperties?.lineWidth;
            if (typeof w === "number" && isFinite(w) && w > 0) {
                return w;
            }
            return settings.line.width.defaultLineWidth.value;
        },
        getRadius: d => {
            const r = d.scatterData?.radius;
            if (r && typeof r === "number" && isFinite(r) && r > 0) {
                return r;
            }
            return settings.defaultRadius.value;
        },
        getFillColor: d => getLayerColor(d.scatterProperties?.fillColor, defaultFillColor, shouldFadeUnselected, fadeFactor, selectedIds, String(d.id)),
        getLineColor: d => getLayerColor(d.scatterProperties?.lineColor, defaultLineColor, shouldFadeUnselected, fadeFactor, selectedIds, String(d.id)),
        radiusMinPixels: settings.radiusMinPixels.value,
        radiusMaxPixels: settings.radiusMaxPixels.value,
        billboard: settings.billboard.billboard.value,
        lineWidthMinPixels: settings.line.width.lineWidthMinPixels.value,
        lineWidthMaxPixels: settings.line.width.lineWidthMaxPixels.value,
        autoHighlight: highlighting.autoHighlight.value,
        highlightColor: autoHighlightColor,
        onClick: (info, event) => onClick(info, event),
        updateTriggers: {
            getLineWidth: [settings.line.width.defaultLineWidth.value, selectedIds],
            getRadius: [settings.defaultRadius.value, selectedIds],
            getFillColor: [settings.fill.defaultFillColor.value.value, settings.fill.defaultFillOpacity.value, highlighting.highlightOnClick.value, highlighting.unselectedFadeOpacity.value, selectedIds],
            getLineColor: [settings.line.color.defaultLineColor.value.value, settings.line.color.defaultLineOpacity.value, highlighting.highlightOnClick.value, highlighting.unselectedFadeOpacity.value, selectedIds],
            highlightColor: [highlighting.autoHighlightColor.value.value, highlighting.autoHighlightOpacity.value],
        },
    });
};