const fs = require('node:fs');
const path = require('node:path');

const workspaceRoot = path.resolve(__dirname, '..');
const wasmPath = path.join(workspaceRoot, 'node_modules', '@wkpjs', 'web', 'dist', 'wkp_core.wasm');
const outputPath = path.join(workspaceRoot, 'src', 'wkpWasmBase64.ts');

if (!fs.existsSync(wasmPath)) {
    throw new Error(`WASM file not found: ${wasmPath}. Run npm install first.`);
}

const wasmBase64 = fs.readFileSync(wasmPath).toString('base64');
const chunkSize = 120;
const chunks = [];
for (let i = 0; i < wasmBase64.length; i += chunkSize) {
    chunks.push(wasmBase64.slice(i, i + chunkSize));
}

const lines = [
    'export const WKP_CORE_WASM_BASE64 =',
    ...chunks.map((chunk, index) => `${index === 0 ? '    ' : '    + '}'${chunk}'`),
    '    ;',
    ''
];

fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
console.log(`Generated ${path.relative(workspaceRoot, outputPath)} from ${path.relative(workspaceRoot, wasmPath)}`);
