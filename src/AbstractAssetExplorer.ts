/* qeslint-disable */
// q@ts-nocheck

import {
    BoundingSphere,
    CallbackProperty,
    Cartographic,
    Cartesian3,
    Cesium3DTileset,
    CesiumTerrainProvider,
    Color,
    ColorMaterialProperty,
    createWorldTerrainAsync,
    Matrix4,
    Math as CesiumMath,
    NearFarScalar,
    OrientedBoundingBox,
    Viewer,
    UrlTemplateImageryProvider
} from "cesium";

import AbstractViewer, { AbstractViewerConstructorOptions } from "./AbstractViewer";
import { parseGeolocaton } from "./parseAjax";
import { georeferencedAtECEF, georeferenceTileset } from "./core/georeferencing";
import { ParsedGlobeAssetInfo } from "./types/common";
import { getTiesetURL } from "./construkted";

class AbstractAssetExplorer extends AbstractViewer {
    protected readonly _assetsData: ParsedGlobeAssetInfo[];

    constructor(options: AbstractViewerConstructorOptions) {
        super(options);

        this._assetsData = this._getGlobeAssets();
    }

    get assetsData() {
        return this._assetsData;
    }

    _init(): void {
        const promiseOfTerrainProvider = createWorldTerrainAsync();

        this._viewer = new Viewer("cesiumContainer", {
            baseLayer: false,
            animation: false,
            homeButton: false, //  the HomeButton widget will not be created.
            baseLayerPicker: false, // If set to false, the BaseLayerPicker widget will not be created.
            geocoder: false,
            sceneModePicker: false,
            timeline: false,
            fullscreenElement: "cesiumContainer",
            requestRenderMode: false,
            navigationHelpButton: false
        });

        const viewer = this._viewer!;

        promiseOfTerrainProvider.then((provider: CesiumTerrainProvider) => {
            viewer.scene.terrainProvider = provider;
        });

        viewer.imageryLayers.removeAll();

        const googleHybridMapTiles = new UrlTemplateImageryProvider({
            url: "https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}"
        });

        viewer.imageryLayers.addImageryProvider(googleHybridMapTiles);

        viewer.resolutionScale = 1.0;
        viewer.scene.globe.depthTestAgainstTerrain = true;
        viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;
        viewer.scene.globe.translucency.enabled = false;
        viewer.scene.postProcessStages.fxaa.enabled = true;

        viewer.scene.globe.translucency.frontFaceAlphaByDistance = new NearFarScalar(400.0, 0.0, 800.0, 1.0);

        viewer.camera.percentageChanged = 0.001;

        viewer.camera.changed.addEventListener(() => {
            this._checkNearTileset();
            this._checkUndergroundAssets();
        });
    }

    _getGlobeAssets() {
        const construktedAssets = this._construktedAjax.assets;

        // maybe embeded viewer

        if (!construktedAssets) return [];

        const ret = [];

        for (let i = 0; i < construktedAssets.length; i++) {
            const asset = construktedAssets[i];

            const parsedGlobeAssetInfo = { ...asset } as unknown as ParsedGlobeAssetInfo;

            const rawAssetGeolocation = asset.asset_geo_location;

            if (rawAssetGeolocation && rawAssetGeolocation !== "") {
                parsedGlobeAssetInfo.asset_geo_location = parseGeolocaton(rawAssetGeolocation);
            } else {
                parsedGlobeAssetInfo.asset_geo_location = undefined;
            }

            parsedGlobeAssetInfo.asset_is_underground = asset.asset_is_underground === "true";
            parsedGlobeAssetInfo.author = parseInt(asset.author, 10);

            if (asset.new_style_url === "" || asset.new_style_url === "false" || asset.new_style_url === undefined) {
                parsedGlobeAssetInfo.newStyleUrl = false;
            } else {
                parsedGlobeAssetInfo.newStyleUrl = Boolean(asset.new_style_url);
            }

            parsedGlobeAssetInfo.loading = false;

            ret.push(parsedGlobeAssetInfo);
        }

        return ret;
    }

    parseAssetsData() {
        this._assetsData.forEach((assetData) => {
            if (assetData.asset_geo_location) {
                const { longitude, latitude, height } = assetData.asset_geo_location;

                assetData.position = Cartesian3.fromDegrees(longitude, latitude, height, undefined, new Cartesian3());
            }
        });
    }

    _tryAddAsset(assetData: ParsedGlobeAssetInfo) {
        if (assetData.tileset) return;
        if (assetData.exists === false) return;
        if (assetData.loading) return;

        assetData.loading = true;

        const postSlug = assetData.post_slug;
        const tilesetServer = window.CONSTRUKTED_AJAX.assets_server;
        const tilesetURL = getTiesetURL(tilesetServer, postSlug, assetData.newStyleUrl);

        const tilesetPromise = Cesium3DTileset.fromUrl(tilesetURL, {
            immediatelyLoadDesiredLevelOfDetail: false,
            skipLevelOfDetail: true,
            loadSiblings: true,
            cacheBytes: 512 * 1024 * 1024,
            maximumCacheOverflowBytes: 256 * 1024 * 1024
        });

        tilesetPromise
            .then((tileset: Cesium3DTileset) => {
                // Model level of detail
                tileset.maximumScreenSpaceError = 8.0; // Default is 16

                // Point cloud point size
                // tileset.pointCloudShading.attenuation = true;
                // tileset.pointCloudShading.maximumAttenuation = 5;

                tileset.pointCloudShading.maximumAttenuation = 3; // Don't allow points larger than 4 pixels.
                // tileset.pointCloudShading.baseResolution = 0.44; // Assume an original capture resolution of 5 centimeters between neighboring points.
                tileset.pointCloudShading.geometricErrorScale = 0.3; // Applies to both geometric error and the base resolution.
                tileset.pointCloudShading.attenuation = true;
                tileset.pointCloudShading.eyeDomeLighting = true;
                tileset.pointCloudShading.eyeDomeLightingStrength = 0.5;
                tileset.pointCloudShading.eyeDomeLightingRadius = 0.5;

                if (!this._applyGeoLocationData(assetData, tileset)) {
                    return;
                }

                this.cesiumViewer.scene.primitives.add(tileset);
                assetData.tileset = tileset;

                if (assetData.asset_is_underground) this._addUndergroundPolyline(assetData);
            })
            .catch((error: any) => {
                assetData.exists = false;
                console.error(error);
            })
            .finally(() => {
                assetData.loading = false;
            });
    }

    _addUndergroundPolyline(assetData: ParsedGlobeAssetInfo) {
        // how to get it?
        const magicTerrainHeight = -50;

        const viewer = this.cesiumViewer;
        const tileset = assetData.tileset as Cesium3DTileset;
        const polylineLengthFromTerrainSurface = 50;

        const fadeColorCallback = new CallbackProperty(() => {
            const cameraPosition = viewer.camera.position;

            const boundingSphereCenter = tileset.boundingSphere.center;
            const dist = Cartesian3.distance(boundingSphereCenter, cameraPosition);
            const boundingSphereCenterCartographic = Cartographic.fromCartesian(boundingSphereCenter);

            const longitude = CesiumMath.toDegrees(boundingSphereCenterCartographic.longitude);
            const latitude = CesiumMath.toDegrees(boundingSphereCenterCartographic.latitude);
            let terrainHeight = viewer.scene.globe.getHeight(boundingSphereCenterCartographic);

            if (!terrainHeight) {
                terrainHeight = 0;
            }

            const end = Cartesian3.fromDegrees(
                longitude,
                latitude,
                terrainHeight + polylineLengthFromTerrainSurface + -magicTerrainHeight
            );
            const polylineLength = Cartesian3.distance(boundingSphereCenter, end);

            const color = Color.YELLOW.clone();

            if (dist >= polylineLength) return color;

            color.alpha = dist / polylineLength;

            return color;
        }, false);

        const polylinePositionsCallback = new CallbackProperty(() => {
            const boundingSphereCenter = tileset.boundingSphere.center;
            const boundingSphereCenterCartographic = Cartographic.fromCartesian(boundingSphereCenter);
            let terrainHeight = viewer.scene.globe.getHeight(boundingSphereCenterCartographic);

            if (Number.isNaN(terrainHeight)) {
                terrainHeight = 0;
            }

            const longitude = CesiumMath.toDegrees(boundingSphereCenterCartographic.longitude);
            const latitude = CesiumMath.toDegrees(boundingSphereCenterCartographic.latitude);

            const endPointHeight = terrainHeight! + polylineLengthFromTerrainSurface + -magicTerrainHeight;

            let end = Cartesian3.fromDegrees(longitude, latitude, endPointHeight);

            if (endPointHeight < boundingSphereCenterCartographic.height) {
                // perhaps the user extrude the tileset too high

                end = boundingSphereCenter;
            }

            return [tileset.boundingSphere.center, end];
        }, false);

        assetData.undergroundPolylineEntity = viewer.entities.add({
            polyline: {
                positions: polylinePositionsCallback,
                width: 2,
                material: new ColorMaterialProperty(fadeColorCallback)
            }
        });
    }

    // eslint-disable-next-line class-methods-use-this
    _applyGeoLocationData(assetData: ParsedGlobeAssetInfo, tileset: Cesium3DTileset) {
        if (!georeferencedAtECEF(tileset)) {
            if (assetData.asset_geo_location) {
                georeferenceTileset(tileset, assetData.asset_geo_location);
            } else {
                console.warn(
                    `non geo referenced asset : title: ${assetData.post_slug} slug: ${assetData.post_slug} is ignored`
                );

                return false;
            }
        } else if (assetData.asset_geo_location) {
            const position = tileset.boundingSphere.center;

            const carto = Cartographic.fromCartesian(position);

            const originalBoundingSphereCenterHeight = carto.height;

            const heightDifference = originalBoundingSphereCenterHeight - assetData.asset_geo_location.height;

            tileset.modelMatrix = Matrix4.fromTranslation(new Cartesian3(0, 0, heightDifference));
        }

        return true;
    }

    _checkNearTileset() {
        const viewer = this.cesiumViewer;

        // in global scale we disable depth testing because point primitives looks slightly buried under the terrain.
        viewer.scene.globe.depthTestAgainstTerrain = false;

        const cameraPosition = viewer.camera.positionWC;

        const tolerance = 10000;

        this._assetsData.forEach((assetData) => {
            if (!assetData.asset_geo_location) {
                return;
            }

            const dist = Cartesian3.distance(assetData.position, cameraPosition);

            if (dist < tolerance) {
                // in detailed scale we enable depth testing to render tileset correctly.
                viewer.scene.globe.depthTestAgainstTerrain = true;

                this._tryAddAsset(assetData);

                if (assetData.tileset) assetData.tileset.show = true;

                // The pink dot should be displayed on the top of the 3d tile bounding box, not on the terrain.

                if (assetData.entity && assetData.tileset && !assetData.adjustEntityPosition) {
                    // @ts-ignore
                    const boundingVolume = assetData.tileset.root.boundingVolume.boundingVolume;

                    let radius = 0;

                    if (boundingVolume instanceof OrientedBoundingBox) {
                        radius =
                            boundingVolume.halfAxes[6] * boundingVolume.halfAxes[6] +
                            boundingVolume.halfAxes[7] * boundingVolume.halfAxes[7] +
                            boundingVolume.halfAxes[8] * boundingVolume.halfAxes[8];

                        radius = Math.sqrt(radius);
                    } else if (boundingVolume instanceof BoundingSphere) {
                        radius = boundingVolume.radius;
                    } else {
                        console.error("error");
                    }

                    let position = assetData.tileset.boundingSphere.center.clone();

                    const magnitude = Cartesian3.magnitude(position);

                    position = Cartesian3.multiplyByScalar(position, (magnitude + radius) / magnitude, position);

                    // @ts-ignore
                    assetData.entity.position = position;

                    assetData.adjustEntityPosition = true;
                }
            } else if (assetData.tileset) {
                assetData.tileset.show = false;
            }
        });
    }

    _checkUndergroundAssets() {
        const viewer = this.cesiumViewer;

        const cameraPosition = viewer.camera.positionWC;

        const tolerance = 10000;

        let approachedUndergroundAsset = false;

        for (let i = 0; i < this._assetsData.length; i++) {
            const assetData = this._assetsData[i];

            // not loaded
            if (!assetData.tileset) continue;

            if (assetData.asset_geo_location) {
                const dist = Cartesian3.distance(assetData.position, cameraPosition);

                if (dist < tolerance) {
                    if (assetData.asset_is_underground) {
                        approachedUndergroundAsset = true;
                        break;
                    }
                }
            }
        }

        viewer.scene.globe.translucency.enabled = approachedUndergroundAsset;
    }
}

export { AbstractAssetExplorer };
