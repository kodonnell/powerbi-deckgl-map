import { decodeHex, withScaledOpacity } from "../col";

export const getLayerColor = (colorProp: string | undefined, defaultColor: [number, number, number, number], shouldFade: boolean, fadeFactor: number, selectedIds: Set<string>, id: string): [number, number, number, number] => {
    const col = decodeHex(colorProp, defaultColor);
    // If we don't have highlighting enabled or there are no selected items, we can skip the extra calculations and just return the line color:
    if (!shouldFade) {
        return col;
    }
    // We have selected items, so we need to fade unselected ones. Check if this item is selected:
    const selected = selectedIds.has(id);
    return withScaledOpacity(col, selected ? 1 : fadeFactor);
};