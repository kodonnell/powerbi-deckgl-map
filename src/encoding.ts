import { createWkp } from '@wkpjs/web';
import { WKP_CORE_WASM_BASE64 } from './wkpWasmBase64';
import { Geometry } from 'geojson';

let wkp: any;
let ctx: any;
let initError: Error | null = null;

function base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

(async () => {
    console.log("Initializing WKP workspace...");
    try {
        const wasmBinary = base64ToUint8Array(WKP_CORE_WASM_BASE64);
        wkp = await createWkp({ wasmBinary });
        console.log("WKP workspace initialized.");
        console.log("Creating WKP workspace...");
        ctx = new wkp.Context();
        console.log("WKP workspace created.");
    } catch (error) {
        initError = error as Error;
        console.error("Failed to initialize WKP workspace.", error);
    }
})();

export function decodeAsGeometry(encoded: string): Geometry {
    console.log("Decoding WKP geometry...");
    if (initError) {
        throw initError;
    }
    if (!wkp || !ctx) {
        throw new Error("WKP is still initializing. Try again after visual startup completes.");
    }
    const decoded = wkp.decode(ctx, encoded);
    const geometry: Geometry = {
        type: decoded.geometry.type,
        coordinates: decoded.geometry.coordinates
    };
    return geometry;
}
