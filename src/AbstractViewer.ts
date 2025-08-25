/* qeslint-disable */
/* eslint-disable  no-restricted-syntax, consistent-return, class-methods-use-this */
// q@ts-nocheck

import {
    Cesium3DTileset,
    CesiumTerrainProvider,
    Color,
    createWorldTerrainAsync,
    Math as CesiumMath,
    NearFarScalar,
    Rectangle,
    ScreenSpaceEventType,
    Scene,
    TileMapServiceImageryProvider,
    Viewer,
    UrlTemplateImageryProvider
} from "cesium";

import { ParsedConstruktedAjax } from "./types/common";
import { MeasureUnits } from "./core";
import { onRequestSession, onSessionStarted, onEndSession } from "./ConstruktedXR";
import { isMobile, showHideTilesInspector } from "./construkted";
import { NavigationControlbar } from "./NavigationControlbar";
import { CesiumFLYCameraController } from "./CesiumFLYCameraController";
import { createFPVController } from "./createFPVController";
import { customizeCesiumViewer } from "./customizeCesiumViewer";
import { StatusBar } from "./StatusBar";

import ScreenSpaceCameraController from "./core/ScreenSpaceCameraController";
// eslint-disable-next-line import/no-relative-packages
import { enableXRDependencies } from "./xr/index";
import { CesiumFPVCameraController } from "./CesiumFPVCameraController";

export enum ViewModes {
    ThreeD = "ThreeD",
    TwoD = "TwoD",
    TwoDNorthUp = "TwoDNorthUp"
}

export interface AbstractViewerConstructorOptions {
    construktedAjax: ParsedConstruktedAjax;
}

export default abstract class AbstractViewer {
    protected _construktedAjax: ParsedConstruktedAjax;

    protected _viewer: Viewer | undefined;

    private _xrButton: any;
    protected _fpvController: CesiumFPVCameraController | undefined;
    private _flyController: CesiumFLYCameraController | undefined;

    protected _viewMode: ViewModes;

    constructor(options: AbstractViewerConstructorOptions) {
        this._construktedAjax = options.construktedAjax;

        this._xrButton = {};

        this._viewMode = ViewModes.ThreeD;

        this._init();

        const scene = this._viewer!.scene;

        scene.preRender.addEventListener(this.onPreRender.bind(this));
    }

    abstract _init(): void;

    _createCesiumViewer() {
        const viewer = new Viewer("cesiumContainer", {
            baseLayer: false,
            animation: false,
            homeButton: false, //  the HomeButton widget will not be created.
            baseLayerPicker: false, // If set to false, the BaseLayerPicker widget will not be created.
            geocoder: false,
            sceneModePicker: false,
            timeline: false,
            fullscreenElement: "cesiumContainer",
            requestRenderMode: false,
            navigationHelpButton: false,
            infoBox: false,
            selectionIndicator: false
        });

        const addCesiumImageryAndTerrain = () => {
            const googleHybridMapTiles = new UrlTemplateImageryProvider({
                url: "https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}"
            });

            viewer.imageryLayers.addImageryProvider(googleHybridMapTiles);

            const promiseOfTerrainProvider = createWorldTerrainAsync();

            promiseOfTerrainProvider.then((provider: CesiumTerrainProvider) => {
                viewer.scene.terrainProvider = provider;
            });
        };

        if (window.localConfig) {
            if (window.localConfig.availableCesiumData) {
                addCesiumImageryAndTerrain();
            } else {
                console.warn("using offline NaturalEarthII");
                const NaturalEarthIIPromise = TileMapServiceImageryProvider.fromUrl(
                    "http://localhost:1217/NaturalEarthII"
                );

                NaturalEarthIIPromise.then((provider: TileMapServiceImageryProvider) => {
                    viewer.imageryLayers.addImageryProvider(provider);
                });
            }
        } else {
            addCesiumImageryAndTerrain();
        }

        // @ts-ignore
        viewer.scene._screenSpaceCameraController = new ScreenSpaceCameraController(viewer.scene);

        const construktedAjax = this._construktedAjax;

        viewer.resolutionScale = 1.0;
        viewer.scene.globe.depthTestAgainstTerrain = false;
        viewer.scene.screenSpaceCameraController.enableCollisionDetection = !construktedAjax.asset_is_underground;
        viewer.scene.globe.translucency.enabled = construktedAjax.asset_is_underground;
        viewer.scene.postProcessStages.fxaa.enabled = true;

        viewer.scene.globe.translucency.frontFaceAlphaByDistance = new NearFarScalar(400.0, 0.0, 800.0, 1.0);

        // disable default entity picking of cesiumjs
        viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);
        viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

        // @ts-ignore
        viewer.extend(Cesium.viewerCesium3DTilesInspectorMixin);

        // @ts-ignore
        this._bottomBar = new StatusBar({
            viewer: viewer,
            measureUnit: new MeasureUnits({
                distanceUnits: construktedAjax.length_unit,
                areaUnits: construktedAjax.area_unit,
                volumeUnits: construktedAjax.volume_unit,
                angleUnits: construktedAjax.angle_unit
            })
        });

        // @ts-ignore
        viewer.cesium3DTilesInspector.viewModel.picking = false;

        showHideTilesInspector(false);

        customizeCesiumViewer(viewer);

        return viewer;
    }

    removeTileset(tileset: Cesium3DTileset) {
        return this._viewer!.scene.primitives.remove(tileset);
    }

    _createNavigationControlbar() {
        const options = {
            cesiumViewer: this._viewer,
            defaultCameraPositionOrientationJson: window.CONSTRUKTED_AJAX.default_camera_position_direction,
            isMobile: isMobile(),
            ignoreCollisionDetection: false,
            immersiveArEnabled: this._xrButton.enabled
        };

        this._fpvController = createFPVController(options);

        this._flyController = new CesiumFLYCameraController({
            isMobile: isMobile(),
            cesiumViewer: this._viewer!
        });

        const controlbarContainer = document.createElement("div");

        controlbarContainer.className = "construkted-viewer-controlbarContainer";

        this._viewer!.container.appendChild(controlbarContainer);

        const controlbar = new NavigationControlbar({
            viewer: this._viewer as Viewer,
            container: controlbarContainer,
            fpvController: this._fpvController,
            flyController: this._flyController
        });

        if (window.location.pathname.includes("embed")) controlbar.hide();
    }

    initXR() {
        enableXRDependencies();

        let xrButton: any;

        try {
            xrButton = new window.CONSTRUKTEDXR.WebXRButton({
                // @ts-ignore
                onRequestSession: onRequestSession,
                onEndSession: onEndSession,
                textEnterXRTitle: "START AR",
                textXRNotFoundTitle: "AR NOT FOUND",
                textExitXRTitle: "EXIT  AR"
            });

            // @ts-ignore
            document.querySelector("#cesiumContainer").appendChild(xrButton.domElement);

            // @ts-ignore
            if (navigator.xr) {
                // Checks to ensure that 'immersive-ar' mode is available, and only
                // enables the button if so.

                // @ts-ignore
                navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
                    xrButton.enabled = supported;
                });

                // @ts-ignore
                navigator.xr.requestSession("inline").then(onSessionStarted);
            }
        } catch (e: any) {
            window.alert(e.message);
        }

        this._xrButton = xrButton;
    }

    get fpvController() {
        return this._fpvController as CesiumFPVCameraController;
    }

    get flyController() {
        return this._flyController as CesiumFLYCameraController;
    }

    xrButton() {
        return this._xrButton;
    }

    get cesiumViewer() {
        return this._viewer as Viewer;
    }

    set translucency(val: boolean) {
        const scene = this._viewer!.scene;

        scene.globe.translucency.enabled = val;

        scene.requestRender();
    }

    addGoogleSatelliteMap() {
        const tms = new UrlTemplateImageryProvider({
            url: "https://mt0.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}"
        });

        const imageryLayers = this._viewer!.imageryLayers;

        imageryLayers.removeAll();

        imageryLayers.addImageryProvider(tms);
    }

    addGoogleHybridMap() {
        const tms = new UrlTemplateImageryProvider({
            url: "https://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}"
        });

        const imageryLayers = this._viewer!.imageryLayers;

        imageryLayers.removeAll();

        imageryLayers.addImageryProvider(tms);
    }

    addGoogleRoadMap() {
        const googleHybridMapTiles = new UrlTemplateImageryProvider({
            url: "https://mt0.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}"
        });

        const imageryLayers = this._viewer!.imageryLayers;

        imageryLayers.removeAll();

        imageryLayers.addImageryProvider(googleHybridMapTiles);
    }

    setSceneBackgroundColor(cssColor: string) {
        const scene = this._viewer?.scene as Scene;
        scene.backgroundColor = Color.fromCssColorString(cssColor);
    }

    showHideSceneBackground(show: boolean) {
        const scene = this._viewer?.scene as Scene;

        scene.globe.show = show;
        scene.skyAtmosphere.show = show;
        scene.skyBox.show = show;
        scene.moon.show = show;
        scene.sun.show = show;

        if (show) scene.backgroundColor = Color.BLACK.clone();
        else scene.backgroundColor = Color.fromCssColorString(window.CONSTRUKTED_AJAX.bg_color_css_string);
    }

    get construktedAjax() {
        return this._construktedAjax;
    }

    addTMSTilesImageryLayer(url: string, rectangle: Rectangle) {
        const tmsPromise = TileMapServiceImageryProvider.fromUrl(url, {
            rectangle: rectangle
        });

        tmsPromise.then((provider: TileMapServiceImageryProvider) => {
            const imageryLayers = this._viewer!.imageryLayers;

            imageryLayers.addImageryProvider(provider);
        });
    }

    onPreRender() {
        const camera = this._viewer!.camera;

        if (this._viewMode === ViewModes.TwoD) {
            camera.setView({
                orientation: {
                    heading: camera.heading,
                    pitch: CesiumMath.toRadians(-89.9)
                }
            });
        } else if (this._viewMode === ViewModes.TwoDNorthUp) {
            camera.setView({
                orientation: { pitch: CesiumMath.toRadians(-89.9) }
            });
        }
    }

    setViewMode(mode: ViewModes) {
        if (this._viewMode === mode) {
            return;
        }

        this._viewMode = mode;
    }

    getCurrentCameraPositionOrientationJsonString() {
        const camera = this._viewer!.camera;
        const carto = camera.positionCartographic;

        const data = {
            longitude: CesiumMath.toDegrees(carto.longitude),
            latitude: CesiumMath.toDegrees(carto.latitude),
            height: carto.height,
            heading: CesiumMath.toDegrees(camera.heading),
            pitch: CesiumMath.toDegrees(camera.pitch),
            roll: CesiumMath.toDegrees(camera.roll)
        };

        return JSON.stringify(data);
    }
}
