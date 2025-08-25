/* qeslint-disable */
// q@ts-nocheck

import {
    CallbackProperty,
    Cartographic,
    Cartesian2,
    Cartesian3,
    Cesium3DTileStyle,
    ColorMaterialProperty,
    Color,
    defined,
    Entity,
    Event,
    HeadingPitchRange,
    Math as CesiumMath,
    Matrix4,
    Scene
} from "cesium";

import { GCPManager, GroundPlane, TilesetAsset, VisualPositionEditor } from "./core";

import AbstractViewer, { AbstractViewerConstructorOptions, ViewModes } from "./AbstractViewer";
import { ConstruktedTransformEditors } from "./types/common";
import { isMobile, flyToTileset, getTiesetURL } from "./construkted";
import { initGeoLocationPopup } from "./initTransformPopup";
import { getOriginallyGeoreferenced, setOriginallyGeoreferenced, saveActiveEditor } from "./construkted_ajax";

export default class AssetViewer extends AbstractViewer {
    private _masterAsset: TilesetAsset | undefined;

    private _undergroundPolylineEntity: Entity | undefined;
    private _checkedUnderground: boolean;
    private _alphaByDistance: number = 0;
    private _fadeByDistance: boolean = false;

    private _gcpManager: GCPManager | undefined;
    private _visualPositionEditor: VisualPositionEditor | undefined;
    private _groundPlane: GroundPlane | undefined;
    private _initialized: Event = new Event();

    constructor(options: AbstractViewerConstructorOptions) {
        super(options);

        this._checkedUnderground = false;
    }

    _init() {
        this._viewer = this._createCesiumViewer();
        this._createNavigationControlbar();

        const construktedAjax = this._construktedAjax;

        this.showHideSceneBackground(construktedAjax.terrain_imagery_enabled);

        this._loadAsset();

        const jqCesiumCanvas = window.jQuery(".cesium-widget > canvas");

        jqCesiumCanvas.doubletap((event: any) => {
            if (
                event &&
                event.originalEvent &&
                event.originalEvent.changedTouches &&
                event.originalEvent.changedTouches[0]
            ) {
                const touch = event.originalEvent.changedTouches[0];

                // touch.clientX, clientY gives wrong values
                // so _getPickedCartographic will internally use other values, so called _lastTapedPosition

                this.fpvController.onDoubleTaped({
                    position: new Cartesian2(touch.clientX as number, touch.clientY as number)
                });
            } else {
                console.warn("can not get position");
            }
        });

        if (!construktedAjax.embed && isMobile()) {
            this.initXR();
        }

        this._fadeByDistance = construktedAjax.asset_is_underground;
        this._alphaByDistance = 0;

        if (construktedAjax.asset_is_underground) {
            this.fadeByDistance = construktedAjax.asset_is_underground;
            this.undergroundPolylineEntityShow = construktedAjax.asset_is_underground;
        }

        this._viewer.scene.globe.depthTestAgainstTerrain = construktedAjax.depth_test_against_terrain;
    }

    get masterAsset() {
        return this._masterAsset as TilesetAsset;
    }

    get viewer() {
        return this._viewer;
    }

    tileset() {
        const masterAsset = this.masterAsset;

        return masterAsset!.tileset;
    }

    get visualPositionEditor() {
        return this._visualPositionEditor;
    }

    get gcpManager() {
        return this._gcpManager;
    }

    _loadAsset() {
        const construktedAjax = this._construktedAjax;

        let tilesetServer = window.jQuery.cookie("ck-storage-server");

        if (!tilesetServer) {
            tilesetServer = window.CONSTRUKTED_AJAX.assets_server;
        }
        const tilesetURL = getTiesetURL(tilesetServer, construktedAjax.post_slug, construktedAjax.new_style_url);

        let assetGeolocation: any;

        if (construktedAjax.active_editor === ConstruktedTransformEditors.VisualPositionEditor) {
            assetGeolocation = construktedAjax.asset_geo_location;
        } else if (construktedAjax.active_editor === ConstruktedTransformEditors.MultiGCPsEditor) {
            assetGeolocation = construktedAjax.asset_geo_location_by_gcps;
        } else if (construktedAjax.active_editor === ConstruktedTransformEditors.PredefinedGeoreference) {
            assetGeolocation = construktedAjax.asset_geo_location_by_pre;
        }

        this._masterAsset = new TilesetAsset({
            type: construktedAjax.asset_type,
            postId: construktedAjax.post_id,
            scene: this._viewer?.scene!,
            assetGeolocation: assetGeolocation,
            ignore_original_transform: construktedAjax.ignore_original_transform,
            tilesetUrl: tilesetURL,
            ignoreRootTransform: !construktedAjax.originally_georeferenced
        });

        this._masterAsset.readyEvt.addEventListener(this._onMaterAssetReady.bind(this));
    }

    async _onMaterAssetReady() {
        const viewer = this._viewer;
        const scene = viewer!.scene;

        const masterAsset = this._masterAsset as TilesetAsset;

        if (masterAsset.originallyGeoreferencedAtECEF) {
            // we enable the underground navigation because asset may be buried by terrain.

            if (scene.screenSpaceCameraController.enableCollisionDetection)
                scene.screenSpaceCameraController.enableCollisionDetection = false;

            console.info("it seems that tileset is directly defined in the WGS84");
        }

        const construktedAjax = this._construktedAjax;

        this._groundPlane = new GroundPlane({
            scene: this._viewer?.scene as Scene,
            size: this.tileset().boundingSphere.radius * 2
        });

        if (
            construktedAjax.asset_geo_location &&
            construktedAjax.active_editor === ConstruktedTransformEditors.VisualPositionEditor
        ) {
            this._groundPlane.setGeolocation(construktedAjax.asset_geo_location);
        } else if (
            construktedAjax.asset_geo_location_by_pre &&
            construktedAjax.active_editor === ConstruktedTransformEditors.PredefinedGeoreference
        ) {
            this._groundPlane.setGeolocation(construktedAjax.asset_geo_location_by_pre);
        } else if (this._masterAsset?.originallyGeoreferencedAtECEF) {
            this._groundPlane.setGeolocation(this._masterAsset?.originalGeolocation());
        }

        this._groundPlane.show = false;

        if (!construktedAjax.asset_geo_location && !construktedAjax.asset_geo_location_by_gcps) {
            if (this._masterAsset?.originallyGeoreferencedAtECEF) {
                if (construktedAjax.active_editor !== ConstruktedTransformEditors.PredefinedGeoreference) {
                    await saveActiveEditor(ConstruktedTransformEditors.PredefinedGeoreference, () => {
                        construktedAjax.active_editor = ConstruktedTransformEditors.PredefinedGeoreference;
                    });
                }
            }
        }

        if (construktedAjax.is_owner) {
            this._visualPositionEditor = new VisualPositionEditor({
                assetViewer: this
            });
        }

        this._checkUnderground();

        const tileset = masterAsset.tileset;

        scene.camera.flyHome = () => {
            flyToTileset({
                viewer: this._viewer!,
                tileset: tileset,
                defaultCameraPositionDirection: this._construktedAjax.default_camera_position_direction
            });
        };

        scene.camera.flyHome();

        this._gcpManager = new GCPManager({
            scene: scene,
            tilesetAsset: masterAsset,
            gcp: construktedAjax.gcp
        });

        if (!construktedAjax.embed) {
            initGeoLocationPopup(this);
        }

        getOriginallyGeoreferenced((response: { originally_georeferenced: string }) => {
            if (!response.originally_georeferenced) {
                if (this._masterAsset?.originallyGeoreferencedAtECEF) {
                    setOriginallyGeoreferenced();
                }
            }
        });

        // hide loading indicator
        jQuery(".viewer-loading").addClass("loaded");

        // enable sidebar
        jQuery("#side-menu-bar-wrapper").removeClass("disabled not-loaded");

        this._initialized.raiseEvent();
    }

    get initialized() {
        return this._initialized;
    }

    get groundPlane() {
        return this._groundPlane as GroundPlane;
    }

    set undergroundPolylineEntityShow(val: boolean) {
        if (this._undergroundPolylineEntity) {
            this._undergroundPolylineEntity.show = val;
        }
    }

    enableDisableUnderground(isUnderground: boolean) {
        const scene = this._viewer?.scene as Scene;

        scene.screenSpaceCameraController.enableCollisionDetection = !isUnderground;
        scene.globe.translucency.enabled = isUnderground;

        this.translucency = isUnderground;
        this.fadeByDistance = isUnderground;
        this.undergroundPolylineEntityShow = isUnderground;
    }

    _createUndergroundPolylineEntity() {
        // how to get it?
        const magicTerrainHeight = -50;

        const viewer = this._viewer!;

        const polylineLengthFromTerrainSurface = 50;
        let polylineEndPosition: Cartesian3 | undefined;

        const fadeColorCallback = new CallbackProperty(() => {
            if (!polylineEndPosition) {
                return Color.YELLOW.clone();
            }

            const cameraPosition = viewer.camera.position;

            const assetPosition = this.masterAsset.position;
            const dist = Cartesian3.distance(assetPosition, cameraPosition);

            const polylineLength = Cartesian3.distance(assetPosition, polylineEndPosition);

            const color = Color.YELLOW.clone();

            if (dist >= polylineLength) return color;

            color.alpha = dist / polylineLength;

            return color;
        }, false);

        const polylinePositionsCallback = new CallbackProperty(() => {
            const assetPosition = this.masterAsset.position;

            const assetPositionCartographic = Cartographic.fromCartesian(assetPosition);
            let terrainHeight = viewer.scene.globe.getHeight(assetPositionCartographic);

            if (!terrainHeight) {
                terrainHeight = 0;
            }

            const longitude = CesiumMath.toDegrees(assetPositionCartographic.longitude);
            const latitude = CesiumMath.toDegrees(assetPositionCartographic.latitude);

            const endPointHeight = terrainHeight + polylineLengthFromTerrainSurface + -magicTerrainHeight;

            polylineEndPosition = Cartesian3.fromDegrees(longitude, latitude, endPointHeight);

            if (endPointHeight <= assetPositionCartographic.height) {
                // the center of bounding sphere is above ground
                // perhaps the user extrude the tileset too high

                polylineEndPosition = Cartesian3.fromDegrees(
                    longitude,
                    latitude,
                    assetPositionCartographic.height + polylineLengthFromTerrainSurface
                );
            }

            return [assetPosition, polylineEndPosition];
        }, false);

        this._undergroundPolylineEntity = viewer.entities.add({
            polyline: {
                positions: polylinePositionsCallback,
                width: 2,
                material: new ColorMaterialProperty(fadeColorCallback)
            }
        });

        this._undergroundPolylineEntity.show = this._construktedAjax.asset_is_underground;
    }

    get fadeByDistance() {
        return this._fadeByDistance;
    }

    set fadeByDistance(val: boolean) {
        this._fadeByDistance = val;

        this._updateAlphaByDistance();
    }

    _updateAlphaByDistance() {
        const scene = this._viewer!.scene;
        const globe = scene.globe;

        globe.translucency.frontFaceAlphaByDistance.nearValue = this._alphaByDistance;

        if (this._fadeByDistance) globe.translucency.frontFaceAlphaByDistance.farValue = 1.0;
        else globe.translucency.frontFaceAlphaByDistance.farValue = this._alphaByDistance;

        scene.requestRender();
    }

    get alphaByDistance() {
        return this._alphaByDistance;
    }

    set alphaByDistance(val) {
        this._alphaByDistance = val;

        this._updateAlphaByDistance();
    }

    // check if tileset is positioned in underground

    _checkUnderground() {
        this._checkedUnderground = false;

        const viewer = this._viewer!;

        viewer.scene.globe.tileLoadProgressEvent.addEventListener(() => {
            if (this._checkedUnderground) {
                // already checked
                return;
            }

            if (viewer.scene.globe.tilesLoaded) {
                const boundingSphereCenterCartographic = Cartographic.fromCartesian(
                    this.tileset().boundingSphere.center
                );

                const terrainHeight = viewer.scene.globe.getHeight(boundingSphereCenterCartographic);

                if (defined(terrainHeight)) {
                    // above ground

                    if (boundingSphereCenterCartographic.height >= terrainHeight!) {
                        this._checkedUnderground = true;

                        if (!this._construktedAjax.asset_is_underground) {
                            return;
                        }

                        console.warn("the asset was marked as underground but the center is above ground.");
                    }
                }

                this._createUndergroundPolylineEntity();

                this._checkedUnderground = true;
            }
        });
    }

    tryDeactivateVisualPositionEditor() {
        if (this._visualPositionEditor?.active) {
            this._visualPositionEditor.deactivate({
                geolocation: undefined,
                terrainImageryEnabled: true
            });
        }
    }

    changeTransparancy(alpha: number) {
        const tileset = this._masterAsset?.tileset;

        tileset!.style = new Cesium3DTileStyle({
            color: `rgba(255, 255, 255, ${alpha})`
        });

        this._viewer!.scene.requestRender();
    }

    setViewMode(mode: ViewModes) {
        super.setViewMode(mode);

        const viewer = this._viewer!;
        const camera = viewer.camera;
        const scene = viewer.scene;

        const tileset = this._masterAsset!.tileset;
        const boundingSphere = tileset?.boundingSphere;

        if (mode === ViewModes.ThreeD) {
            // @ts-ignore
            scene.screenSpaceCameraController.enableVerticalRotating = true;
            scene.screenSpaceCameraController.enableTilt = true;
            camera.flyToBoundingSphere(boundingSphere);
        } else if (mode === ViewModes.TwoD) {
            camera.cancelFlight();
            scene.screenSpaceCameraController.enableTilt = true;
            // @ts-ignore
            scene.screenSpaceCameraController.enableVerticalRotating = false;

            camera.viewBoundingSphere(
                boundingSphere,
                new HeadingPitchRange(0, CesiumMath.toRadians(-89.9), boundingSphere.radius * 4)
            );
            camera.lookAtTransform(Matrix4.IDENTITY);
        } else if (mode === ViewModes.TwoDNorthUp) {
            camera.cancelFlight();
            scene.screenSpaceCameraController.enableTilt = false;

            camera.viewBoundingSphere(
                boundingSphere,
                new HeadingPitchRange(0, CesiumMath.toRadians(-89.9), boundingSphere.radius * 4)
            );
            camera.lookAtTransform(Matrix4.IDENTITY);
        }
    }
}
