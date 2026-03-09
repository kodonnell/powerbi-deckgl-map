# Power BI deck.gl map custom visual

Designed to support points / lines / polygons from <https://deck.gl/docs/api-reference/layers/geojson-layer> (i.e. not text/icons yet).

## Install

- Download the latest `*.pbiviz` from <https://github.com/Feltzem/powerbi-deckgl-map/releases>
- [Install a custom visual in Power BI](https://learn.microsoft.com/en-us/power-bi/developer/visuals/import-visual#import-a-visual-file-from-your-local-computer-into-power-bi).

## Usage

For now, the main things to know:

- Terminology and variables closely match those from [deck.gl](https://deck.gl/)
- We support the following layers:
  - Scatter - for scatters/points. See [ScatterplotLayer](https://deck.gl/docs/api-reference/layers/scatterplot-layer).
  - Line - for a straight line from one point to another. See [LineLayer](https://deck.gl/docs/api-reference/layers/line-layer).
  - Arc - for an arc from one point to another. See [ArcLayer](https://deck.gl/docs/api-reference/layers/arc-layer).
  - Path - for a sequence of points making a 2D path/linestring. See [PathLayer](https://deck.gl/docs/api-reference/layers/path-layer).
  - Polygon - for a sequence of points making a polygon. See [PolygonLayer](https://deck.gl/docs/api-reference/layers/polygon-layer).
- We can only (?) have a single input to a visual, which means if we want multiple geometry types on each visual, they all need to be in the same table. Therefore:
  - We specify a geometry type column which contains either `'scatter'`, `'arc'`, `'line'`, `'path'`, or `'polygon'` to specify which type to draw. (These strings can be customised in the options.)
  - Individual columns/values/defaults for each of the different attributes. E.g. you can have a column for the scatter fill color or polygon fill color (which can be the same).
- To support e.g. custom colors/widths per line/row, we allow the user to provide their own #RGB (for color) or float (for width). In Javascript we could let the user just provide a custom function (as deck.gl does), but that's trickier in Power BI.

## TODO

- Allow Z in polygon and path layer.
- Allow scatter to be from WKT/WKP.
- Add example pbix.
- Add screenshots to readme.
- Add satellite layer?
- Add icon to reset the map tilt/bearing.
- Add setting for autohighlight for each layer.
- highlight this way: <https://learn.microsoft.com/en-us/power-bi/developer/visuals/highlight?tabs=Standard>
- selection only works on lines/arcs
- extra layers:
  - <https://deck.gl/docs/api-reference/layers/column-layer>
  - switch polygon layer to <https://deck.gl/docs/api-reference/layers/solid-polygon-layer>
  - aggregate:
    - <https://deck.gl/docs/api-reference/aggregation-layers/heatmap-layer>
    - <https://deck.gl/docs/api-reference/aggregation-layers/hexagon-layer>
- versioning - ensure package.json, pbiviz.json and the release all have same version.
- vector layers ... why not working? CORS issue it seems, even if allowed through.

## Developing

- Make sure you're using Powershell 7.
- `pbiviz install-cert` - make sure you install it, may need to run multiple times.
- `pbiviz start`
- in your browser, go to `https://localhost:8080/assets/` - if complains about certs, you may need to install. Or click "go ahead" which will let you dev.
- go to `app.powerbi.com`, enable developer mode, and add a custom visual.

If you update the `@wkpjs/web` version, re-run `npm run generate:wkp-wasm` - we embed the wasm since PowerBI prevents loading it.

## Building

- `pbiviz package`

## Releasing

To create a new release:

1. Update the version in `pbiviz.json` and `package.json`.
2. Push a new tag: `git tag v1.x.x && git push origin v1.x.x`.
3. The GitHub Action will automatically build and create a GitHub Release with the `.pbiviz` asset.
