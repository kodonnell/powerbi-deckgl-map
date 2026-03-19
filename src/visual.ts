"use strict";

import * as process from "process";
(window as any).process = process;

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import VisualDataChangeOperationKind = powerbi.VisualDataChangeOperationKind;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;


import { MapCardSettings, VisualFormattingSettingsModel } from "./settings";
import { Map } from 'maplibre-gl';
import { MapboxOverlay as DeckOverlay } from '@deck.gl/mapbox';
import { NavigationControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createSelectorDataPoints } from "./mapper";

import { getPointsFromData, OurData } from "./dataTypes";
import getScatterLayer from "./layers/scatter";
import getLineLayer from "./layers/line";
import getArcLayer from "./layers/arc";
import getPathLayer from "./layers/path";
import getPolygonLayer from "./layers/polygon";


export class Visual implements IVisual {
    private host: IVisualHost;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private map: any;
    private selectionManager: powerbi.extensibility.ISelectionManager;
    private dataPoints: OurData[];
    private deckOverlay: DeckOverlay | null;
    private decodeCache: {};
    private selectedIds: string[];
    private lastOptions: VisualUpdateOptions | null;
    private hasManuallyBeenNavigated: boolean;
    private currentBaseMap: string;
    private selectionSource: "none" | "map" | "external";
    private internalSelectionRequestCount: number;

    private createResetViewControl() {
        const container = document.createElement("div");
        container.className = "maplibregl-ctrl maplibregl-ctrl-group";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "deckgl-reset-view-button";
        button.title = "Reset map";
        button.setAttribute("aria-label", "Reset map view");
        button.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.resetViewToAllData();
        };

        container.appendChild(button);

        return {
            onAdd: () => container,
            onRemove: () => {
                container.remove();
            }
        };
    }

    private getBoundsFromDataPoints(dataPoints: OurData[]) {
        let minLat = 90;
        let maxLat = -90;
        let minLon = 180;
        let maxLon = -180;
        let anyPoints = false;

        dataPoints.forEach((d) => {
            const points = getPointsFromData(d);
            let n = points.length;
            if (n > 0) {
                anyPoints = true;
            }
            while (n--) {
                const p = points[n];
                const lat = p.lat;
                const lon = p.lon;
                if (lat < minLat) {
                    minLat = lat;
                }
                if (lat > maxLat) {
                    maxLat = lat;
                }
                if (lon < minLon) {
                    minLon = lon;
                }
                if (lon > maxLon) {
                    maxLon = lon;
                }
            }
        });

        return {
            minLat,
            maxLat,
            minLon,
            maxLon,
            anyPoints
        };
    }

    private resetViewToAllData() {
        if (!this.map) {
            return;
        }

        const mapSettings = this.formattingSettings?.map
            || this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, null).map;
        const duration = mapSettings.flyToDuration.value;
        const ll500 = 500 * 1e-5;

        const center = this.map.getCenter();
        this.map.jumpTo({
            center,
            zoom: this.map.getZoom(),
            bearing: 0,
            pitch: 0,
        });

        const bounds = this.getBoundsFromDataPoints(this.dataPoints || []);
        if (!bounds.anyPoints) {
            this.map.fitBounds(
                [[mapSettings.initialWest.value, mapSettings.initialSouth.value], [mapSettings.initialEast.value, mapSettings.initialNorth.value]],
                { duration }
            );
        } else {
            const flyToPadding = mapSettings.flyToPadding.value / 100;
            let dLat = (bounds.maxLat - bounds.minLat) * flyToPadding;
            let dLon = (bounds.maxLon - bounds.minLon) * flyToPadding;
            dLat = Math.max(dLat, ll500);
            dLon = Math.max(dLon, ll500);

            this.map.fitBounds(
                [[bounds.minLon - dLon, bounds.minLat - dLat], [bounds.maxLon + dLon, bounds.maxLat + dLat]],
                { duration }
            );
        }

        this.hasManuallyBeenNavigated = false;
        this.selectionSource = "none";
        this.selectedIds = [];
        this.internalSelectionRequestCount++;
        this.selectionManager.clear().finally(() => {
            this.internalSelectionRequestCount = Math.max(0, this.internalSelectionRequestCount - 1);
            if (this.lastOptions) {
                this.update(this.lastOptions);
            }
        });
    }

    private isMultiSelectEvent(event: any): boolean {
        const candidates = [
            event,
            event?.originalEvent,
            event?.srcEvent,
            event?.sourceEvent,
            event?.originalEvent?.srcEvent,
            event?.srcEvent?.originalEvent,
            event?.sourceEvent?.originalEvent,
            event?.sourceEvent?.srcEvent,
        ];
        return candidates.some((ev) => !!(ev && (ev.ctrlKey || ev.metaKey)));
    }

    private getSelectionKey(selectionId: any): string | null {
        if (!selectionId) {
            return null;
        }
        const getKey = selectionId.getKey;
        if (typeof getKey === "function") {
            return getKey.call(selectionId);
        }
        return null;
    }

    private syncSelectedIdsFromSelectionIds(selectionIds: any[]): boolean {
        const keySet = new Set(
            (selectionIds || [])
                .map((selectionId) => this.getSelectionKey(selectionId))
                .filter((key): key is string => !!key)
        );

        const nextSelectedIds = this.dataPoints
            .filter((d) => {
                const key = this.getSelectionKey(d.selectionId);
                return key !== null && keySet.has(key);
            })
            .map((d) => d.id);

        const changed = nextSelectedIds.length !== this.selectedIds.length
            || nextSelectedIds.some((id) => !this.selectedIds.includes(id));

        if (changed) {
            this.selectedIds = nextSelectedIds;
        }

        return changed;
    }

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.selectionManager = options.host.createSelectionManager();
        const registerOnSelectCallback = (this.selectionManager as any).registerOnSelectCallback;
        if (typeof registerOnSelectCallback === "function") {
            registerOnSelectCallback.call(this.selectionManager, (selectionIds: any[]) => {
                if (this.internalSelectionRequestCount === 0) {
                    this.selectionSource = (selectionIds && selectionIds.length > 0) ? "external" : "none";
                }
                const changed = this.syncSelectedIdsFromSelectionIds(selectionIds || []);
                if (changed && this.lastOptions) {
                    this.update(this.lastOptions);
                }
            });
        }
        const localizationManager = this.host.createLocalizationManager();
        this.formattingSettingsService = new FormattingSettingsService(localizationManager);
        this.dataPoints = [];
        this.deckOverlay = null;
        this.decodeCache = {};
        this.selectedIds = [];
        this.hasManuallyBeenNavigated = false;
        this.selectionSource = "none";
        this.internalSelectionRequestCount = 0;

        // Get the settings:
        const settings = this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, null);
        this.formattingSettings = settings;
        this.currentBaseMap = settings.map.baseMap.value.value as string;

        if (document) {
            this.map = new Map({
                container: options.element,
                style: this.getMapStyle(settings.map.baseMap.value.value as string),
                canvasContextAttributes: { antialias: true },
                maxZoom: 20 // To match tiles

            });
            this.map.on('error', (e) => {
                console.log("Error", e);
            });
            this.map.on('load', () => {
                console.log("Loaded");
                this.hasManuallyBeenNavigated = false;
                this.deckOverlay = new DeckOverlay({
                    interleaved: false, // Don't set to true - bricks performance!
                    layers: [],
                    onHover: (hoverInfo) => {
                        // MapLibre controls the canvas cursor, so set it directly from pick state.
                        const canvas = this.map?.getCanvas?.();
                        if (!canvas) {
                            return;
                        }
                        canvas.style.cursor = hoverInfo?.object ? "pointer" : "grab";
                    },
                    onClick: () => {
                        // Clear things:
                        console.log("Map clicked - clearing selection");
                        this.selectionSource = "map";
                        this.selectedIds = [];
                        this.internalSelectionRequestCount++;
                        this.selectionManager.clear().finally(() => {
                            this.internalSelectionRequestCount = Math.max(0, this.internalSelectionRequestCount - 1);
                            if (this.lastOptions) {
                                this.update(this.lastOptions);
                            }
                        });
                    },
                    pickingRadius: 5,
                    getTooltip: (hoverInfo) => {
                        if (!hoverInfo.object || !hoverInfo.object.tooltipHtml) {
                            return null;
                        }

                        return {
                            html: "<div>" + hoverInfo.object.tooltipHtml + "</div>",
                            style: {
                                "z-index": 2,
                                "color": "#a0a7b4",
                                "background-color": "#29323c",
                                "padding": "2px 5px",
                                "border-radius": "3px",
                                "margin": "0px",
                                "font-size": "12px",
                                "margin-left": "25px", // Offset from the mouse
                            }
                        };
                    }
                });
                this.map.on('movestart', () => {
                    console.log("Map move started");
                    this.hasManuallyBeenNavigated = true;
                });
                this.map.on('moveend', () => {
                    console.log("Map move ended");
                });
                this.map.addControl(this.deckOverlay);
                this.map.addControl(new NavigationControl());
                this.map.addControl(this.createResetViewControl(), 'top-left');
            })
        }
    }

    private getMapStyle(baseMap: string) {
        return {
            'version': 8 as const,
            'sources': {
                'raster-tiles': {
                    'type': 'raster' as const,
                    'tiles': [
                        `https://a.basemaps.cartocdn.com/${baseMap}/{z}/{x}/{y}{r}.png`,
                        `https://b.basemaps.cartocdn.com/${baseMap}/{z}/{x}/{y}{r}.png`,
                        `https://c.basemaps.cartocdn.com/${baseMap}/{z}/{x}/{y}{r}.png`,
                        `https://d.basemaps.cartocdn.com/${baseMap}/{z}/{x}/{y}{r}.png`,
                    ],
                    'tileSize': 256,
                    'attribution': '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                }
            },
            'layers': [
                {
                    'id': 'simple-tiles',
                    'type': 'raster' as const,
                    'source': 'raster-tiles',
                    'minzoom': 0,
                    'maxzoom': 20,
                }
            ]
        };
    }

    public onClick = (info, event) => {
        console.log(`Clicked on layer ${info.layer.id}`);
        if (info.object) {
            this.selectionSource = "map";
            const multiSelect = this.isMultiSelectEvent(event);

            // Filter the selections:
            const id = info.object.id;
            // const selectionId = info.object.selectionId;
            if (!id) {
                console.log("Clicked on object with no id or selectionId - ignoring", info.object);
                return true;
            }
            console.log("Clicked on object with id", id, "multiSelect:", multiSelect);
            console.log("[Selection][click] selectedIds before=", this.selectedIds);
            if (multiSelect) {
                if (this.selectedIds.includes(id)) {
                    this.selectedIds = this.selectedIds.filter(x => x !== id);
                } else {
                    this.selectedIds.push(id);
                }
            } else {
                this.selectedIds = [id];
            }
            console.log("[Selection][click] selectedIds after local toggle=", this.selectedIds);

            // Now get the selection IDs of the ones we're selected. (NB: why not use the selection manager and
            // info.object.properties.selectionId? Well, for some reason the selection ID is in an undefined stat)
            const selectedIds = this.dataPoints.filter(x => this.selectedIds.includes(x.id)).map(x => x.selectionId);
            if (selectedIds.length === 0) {
                this.internalSelectionRequestCount++;
                this.selectionManager.clear().then(() => {
                    this.selectedIds = [];
                }).finally(() => {
                    this.internalSelectionRequestCount = Math.max(0, this.internalSelectionRequestCount - 1);
                });
            } else {
                this.internalSelectionRequestCount++;
                this.selectionManager.select(selectedIds, false).finally(() => {
                    this.internalSelectionRequestCount = Math.max(0, this.internalSelectionRequestCount - 1);
                });
            }

            // Update so we can draw the highlights
            this.update(this.lastOptions);
            return true; // don't propagate the event
        }
    };

    public handleFlyTo(settings: MapCardSettings, dataFilterApplied: boolean, allowSelectionFlyTo: boolean, selectedIdsOverride?: string[]) {
        var minLat = 90, maxLat = -90, minLon = 180, maxLon = -180, anyPoints = false;

        // We only fly to if:
        // - We have never been manually navigated
        // - There is a selection *or filter*, and we want to fly to that

        const activeSelectedIds = selectedIdsOverride || this.selectedIds;
        const anySelected = activeSelectedIds.length !== 0;
        console.log(`Has manually navigated: ${this.hasManuallyBeenNavigated}, any selected: ${anySelected}, data filter applied: ${dataFilterApplied}`);
        const canFlyTo = anySelected ? (allowSelectionFlyTo || dataFilterApplied) : (!this.hasManuallyBeenNavigated || dataFilterApplied);
        console.log("[FlyTo] selectionSource=", this.selectionSource, "allowSelectionFlyTo=", allowSelectionFlyTo, "canFlyTo=", canFlyTo);
        if (!canFlyTo) {
            if (anySelected && this.selectionSource === "map" && !allowSelectionFlyTo && !dataFilterApplied) {
                console.log("[FlyTo] blocked: map-origin click selection does not trigger zoom.");
            }
            console.log("Not flying to selected because user has manually navigated");
            return;
        }

        this.dataPoints.forEach((d) => {
            // If there's a filter selected, only include those points
            if (anySelected && !activeSelectedIds.includes(d.id)) {
                return;
            }
            const points = getPointsFromData(d);
            let n = points.length;
            if (n > 0) {
                anyPoints = true;
            }
            while (n--) {
                let p = points[n],
                    lat = p.lat,
                    lon = p.lon;
                if (lat < minLat) {
                    minLat = lat;
                }
                if (lat > maxLat) {
                    maxLat = lat;
                }
                if (lon < minLon) {
                    minLon = lon;
                }
                if (lon > maxLon) {
                    maxLon = lon;
                }
            }
        });
        console.log(`Data bounds: ${minLat},${minLon} to ${maxLat},${maxLon} (any points: ${anyPoints})`);
        const defaultMinLat = settings.initialSouth.value, defaultMaxLat = settings.initialNorth.value, defaultMinLon = settings.initialWest.value, defaultMaxLon = settings.initialEast.value;
        if (!anyPoints) {
            this.map.fitBounds([[defaultMinLon, defaultMinLat], [defaultMaxLon, defaultMaxLat]], { duration: settings.flyToDuration.value });
        } else {
            // OK, don't bother jumping unless:
            // - The intersection of the bounding box containing data is less than 1% of the map AND the maps looking at greater than 30km horizontally
            // - A data point is within 10% of the current edge of the map
            const bounds = this.map.getBounds();
            const boundsLat0 = bounds.getSouth();
            const boundsLat1 = bounds.getNorth();
            const boundsLon0 = bounds.getWest();
            const boundsLon1 = bounds.getEast();
            // Calculate intersection:
            const intersectionLat0 = Math.max(boundsLat0, minLat);
            const intersectionLat1 = Math.min(boundsLat1, maxLat);
            const intersectionLon0 = Math.max(boundsLon0, minLon);
            const intersectionLon1 = Math.min(boundsLon1, maxLon);
            // OK first condition, zooming in:
            const intersectionArea = (intersectionLat1 - intersectionLat0) * (intersectionLon1 - intersectionLon0);
            const mapArea = (boundsLat1 - boundsLat0) * (boundsLon1 - boundsLon0);
            const ll500 = 500 * 1e-5;
            let doZoom = false;
            const mapWidthMeters = (boundsLon1 - boundsLon0) / 1e-5;
            if (intersectionArea / mapArea < 0.01 && mapWidthMeters > 10000) {
                console.log(`Data zoomed area too small! Intersection area ${intersectionArea}, map area ${mapArea}, map width ${mapWidthMeters.toFixed(0)} m`);
                doZoom = true;
            } else {
                const dLat = (bounds.getNorth() - bounds.getSouth()) * 0.1;
                const dLon = (bounds.getEast() - bounds.getWest()) * 0.1;
                if (minLat < boundsLat0 + dLat || maxLat > boundsLat1 - dLat || minLon < boundsLon0 + dLon || maxLon > boundsLon1 - dLon) {

                    console.log("Data points outside 10% internal buffer of map");
                    doZoom = true;
                }
            }
            if (doZoom) {
                // Add buffer of either % of data width or 500m, whichever is larger
                const flyToPadding = settings.flyToPadding.value / 100;
                let dLat = (maxLat - minLat) * flyToPadding;
                let dLon = (maxLon - minLon) * flyToPadding;
                dLat = Math.max(dLat, ll500);
                dLon = Math.max(dLon, ll500);
                this.map.fitBounds([[minLon - dLon, minLat - dLat], [maxLon + dLon, maxLat + dLat]], { duration: settings.flyToDuration.value });
            }
        }

    }

    // Update: debounce updates to avoid multiple updates in quick succession when data is loading, or when multiple properties are changing at once.
    private updateQueued = false;
    private pendingUpdateOptions: VisualUpdateOptions | null = null;
    public update(options: VisualUpdateOptions) {
        this.pendingUpdateOptions = options;
        if (this.updateQueued) return;
        this.updateQueued = true;
        setTimeout(() => {
            const latestOptions = this.pendingUpdateOptions;
            this.pendingUpdateOptions = null;

            if (latestOptions) {
                this.performUpdate(latestOptions);
            }

            this.updateQueued = false;

            // If another update arrived while processing, queue another pass.
            if (this.pendingUpdateOptions) {
                this.update(this.pendingUpdateOptions);
            }
        }, 150);
    }

    public performUpdate(options: VisualUpdateOptions) {
        this.lastOptions = options;
        if (this.deckOverlay === null) {
            console.log("Deck overlay not ready - retying in 100ms");
            setTimeout(() => {
                this.update(options);
            }, 100);
            return;
        }
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, options.dataViews[0]);
        var settings = this.formattingSettings;

        // Check if baseMap changed
        const newBaseMap = settings.map.baseMap.value.value as string;
        if (newBaseMap !== this.currentBaseMap) {
            this.map.setStyle(this.getMapStyle(newBaseMap));
            this.currentBaseMap = newBaseMap;
        }

        const dataView = options.dataViews?.[0];
        if (!dataView) {
            this.dataPoints = [];
            this.deckOverlay.setProps({ layers: [] });
            return;
        }

        // Only request more data while Power BI is actively streaming data segments.
        // Non-data updates (resize/format/selection) may have no operationKind and must not trigger fetchMoreData.
        let shouldRequestMoreData = false;
        if (options.operationKind == VisualDataChangeOperationKind.Create) {
            console.log("New data arrived");
            shouldRequestMoreData = !!dataView.metadata?.segment;
            if (!shouldRequestMoreData) {
                console.log("Data load finished - the first segment is the only one.");
            }
        } else if (options.operationKind == VisualDataChangeOperationKind.Append) {
            shouldRequestMoreData = !!dataView.metadata?.segment;
            if (!shouldRequestMoreData) {
                console.log("Data load finished - this is the last segment.");
            }
        }

        if (shouldRequestMoreData) {
            this.host.fetchMoreData(true);
            return;
        }

        console.log("Data load finished - processing data");

        // OK, process the data now we've got all of it.
        // TODO: if we want, we could draw it iteratively, but this will increase total execution time.
        this.dataPoints = createSelectorDataPoints(options, settings, this.host, this.decodeCache);
        const visibleIdSet = new Set(this.dataPoints.map((d) => d.id));
        this.selectedIds = this.selectedIds.filter((id) => visibleIdSet.has(id));

        const dataHighlightedIds = this.dataPoints.filter((d) => d.isHighlightedFromData).map((d) => d.id);
        const dataFilterApplied = options.dataViews[0].metadata.isDataFilterApplied;
        const externallySelectedIds = dataHighlightedIds.length > 0
            ? dataHighlightedIds
            : (dataFilterApplied ? this.dataPoints.map((d) => d.id) : []);

        if (this.internalSelectionRequestCount === 0) {
            this.selectionSource = externallySelectedIds.length > 0
                ? "external"
                : (this.selectedIds.length > 0 ? this.selectionSource : "none");
        }

        const effectiveSelectedIds = externallySelectedIds.length > 0 ? externallySelectedIds : this.selectedIds;
        const hasMapSelection = this.selectionSource === "map" && this.selectedIds.length > 0;
        const shouldShowHighlightLayers = dataHighlightedIds.length > 0 || (settings.highlighting.highlightOnClick.value && hasMapSelection);
        const allowSelectionFlyTo = dataHighlightedIds.length > 0 || this.selectionSource === "external";

        if (settings.map.flyTo.value) {
            this.handleFlyTo(settings.map, dataFilterApplied, allowSelectionFlyTo, effectiveSelectedIds);
        }
        const layers = [
            getScatterLayer(false, this.dataPoints, settings.scatter, settings.highlighting, effectiveSelectedIds, this.onClick),
            getLineLayer(false, this.dataPoints, settings.line, settings.highlighting, effectiveSelectedIds, this.onClick),
            getArcLayer(false, this.dataPoints, settings.arc, settings.highlighting, effectiveSelectedIds, this.onClick),
            getPathLayer(false, this.dataPoints, settings.path, settings.highlighting, effectiveSelectedIds, this.onClick),
            getPolygonLayer(false, this.dataPoints, settings.polygon, settings.highlighting, effectiveSelectedIds, this.onClick),
        ];
        if (shouldShowHighlightLayers) {
            const highlightLayers = [
                getScatterLayer(true, this.dataPoints, settings.scatter, settings.highlighting, effectiveSelectedIds, this.onClick),
                getLineLayer(true, this.dataPoints, settings.line, settings.highlighting, effectiveSelectedIds, this.onClick),
                getArcLayer(true, this.dataPoints, settings.arc, settings.highlighting, effectiveSelectedIds, this.onClick),
                getPathLayer(true, this.dataPoints, settings.path, settings.highlighting, effectiveSelectedIds, this.onClick),
                getPolygonLayer(true, this.dataPoints, settings.polygon, settings.highlighting, effectiveSelectedIds, this.onClick),
            ];
            layers.push(...highlightLayers);
        }
        this.deckOverlay.setProps({ layers });

    }
    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}

