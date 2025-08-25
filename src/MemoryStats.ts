import { Cesium3DTileset } from "cesium";

export class MemoryStats {
    constructor() {
        if (jQuery("#memory-stat").length === 0) {
            // this is not admin user
            return;
        }

        const construkted = window.Construkted;

        if (!construkted.isTilesetAsset() && !construkted.isProject()) {
            return;
        }

        const viewer = construkted.cesiumViewer;

        viewer.clock.onTick.addEventListener(this._onTick.bind(this));

        const tilesetAssets = window.Construkted.tilesetAssets;

        tilesetAssets.forEach((tilesetAsset) => {
            tilesetAsset.readyEvt.addEventListener(() => {
                this._onTilesetReady(tilesetAsset.tileset);
            });
        });
    }

    // eslint-disable-next-line class-methods-use-this
    _onTilesetReady(tileset: Cesium3DTileset) {
        const loadStatus = document.getElementById("loadStatus")!;
        const pendingRequests = document.getElementById("pendingRequests")!;
        const tilesProcessing = document.getElementById("tilesProcessing")!;

        let startTime: number;
        let isLoading = false;

        // eslint-disable-next-line prefer-arrow-callback
        tileset.loadProgress.addEventListener(function (
            numberOfPendingRequests: number,
            numberOfTilesProcessing: number
        ) {
            pendingRequests.innerHTML = numberOfPendingRequests.toString();
            tilesProcessing.innerHTML = numberOfTilesProcessing.toString();

            if (numberOfPendingRequests === 0 && numberOfTilesProcessing === 0) {
                return;
            }

            if (!isLoading) {
                startTime = performance.now();
                isLoading = true;
                loadStatus.innerHTML = "Loading...";
            }
        });

        // eslint-disable-next-line prefer-arrow-callback
        tileset.initialTilesLoaded.addEventListener(function () {
            const loadingTime = ((performance.now() - startTime) / 1000.0).toFixed(3);
            loadStatus.innerHTML = `Initial tiles loaded in ${loadingTime} seconds`;
        });

        // eslint-disable-next-line prefer-arrow-callback
        tileset.allTilesLoaded.addEventListener(function () {
            const loadingTime = ((performance.now() - startTime) / 1000.0).toFixed(3);
            loadStatus.innerHTML = `New tiles loaded in ${loadingTime} seconds`;
            isLoading = false;
        });
    }

    // eslint-disable-next-line class-methods-use-this
    _onTick() {
        const tilesetAssets = window.Construkted.tilesetAssets;

        const tilesets: Cesium3DTileset[] = [];

        tilesetAssets.forEach((asset) => {
            tilesets.push(asset.tileset);
        });

        let cacheSize = 0;
        let selectedTiles = 0;
        let memoryUsage = 0;
        let memoryAdjustedScreenSpaceError = 0;

        tilesets.forEach((tileset) => {
            if (!tileset) {
                return;
            }

            // @ts-ignore
            cacheSize += tileset._cache._list.length;
            // @ts-ignore
            selectedTiles += tileset._selectedTiles.length;
            memoryUsage += tileset.totalMemoryUsageInBytes;
            // @ts-ignore
            memoryAdjustedScreenSpaceError += tileset.memoryAdjustedScreenSpaceError;
        });

        memoryAdjustedScreenSpaceError /= tilesetAssets.length;

        jQuery("#cacheSize").text(cacheSize);
        jQuery("#selectedTiles").text(selectedTiles);
        jQuery("#memoryUsage").text((memoryUsage / 1024 / 1024).toFixed(1));
        jQuery("#adjustedSSE").text(memoryAdjustedScreenSpaceError.toFixed(2));
    }
}
