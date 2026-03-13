import powerbi from "powerbi-visuals-api";

export const getNumberFromPrimitive = (value: powerbi.PrimitiveValue): number | null => {
    if (value === null) {
        return null;
    }
    const num = parseFloat(value.toString());
    return Number.isNaN(num) ? null : num;
}

export const getNumberFromValue = (col: powerbi.PrimitiveValue | null): number | null => {
    if (!col) {
        return null;
    }
    return getNumberFromPrimitive(col);
}