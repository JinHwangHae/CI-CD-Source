/* qeslint-disable */
// q@ts-nocheck

// will move functions of contrukted.ts here

import {
    Camera,
    Cartesian3,
    Cartographic,
    Cesium3DTileset,
    ClippingPlane,
    ClippingPlaneCollection,
    Color,
    DeveloperError,
    Event,
    Matrix3,
    Matrix4,
    Plane,
    Quaternion,
    Transforms,
    Viewer
} from "cesium";

import {
    Asset,
    CanvasEventHandler,
    CRSInfo,
    CRSManager,
    LabelService,
    MeasureUnits,
    MapTool,
    TilesetAsset,
    TilesetAssetShadingModes,
    TMSTilesAsset,
    TilesetAssetGroup
} from "./core";

import {
    AssetInfo,
    ConstruktedAjaxType,
    ConstruktedAssetType,
    ParsedConstruktedAjax,
    ParsedGlobeAssetInfo,
    RawAssetInfo
} from "./types/common";

import {
    ClippingTools,
    DistanceMeasurement,
    DistanceMeasurementEditTool,
    DrawingTools,
    HullCalculator,
    ImagePlane,
    ImagePlaneEditTool,
    MeasurementTools,
    MeasurementType,
    NoteDrawing,
    NoteEditTool,
    PointMeasurementEditTool,
    PolygonDrawing,
    PolylineDrawing,
    PolygonEditTool,
    PolylineEditTool
    // VideoRecorder,
    // VideoRecorderWidget
} from "./tools";

import AssetViewer from "./AssetViewer";
import ProjectViewer from "./ProjectViewer";
import OrthomosaicViewer from "./OrthomosaicViewer";
import { saveSceneBackgroundColor } from "./construkted_ajax";
import { parseAssetInfo } from "./parseAjax";
import LayersPanel from "./LayersPanel";
import Util from "./Util";
import NavigationHelper from "./NavigationHelper";
import PickGlobeDegugger from "./PickGlobeDebugger";
import { ViewModes } from "./AbstractViewer";
import { DrawingType } from "./tools/annotation/drawing/common";
import { AreaMeasurement } from "./tools/annotation/measure/AreaMeasurement";
import { PolylineMeasurement } from "./tools/annotation/measure/PolylineMeasurement";
import { Project } from "./project/Project";
import { VolumeMeasurement } from "./tools/annotation/measure/VolumeMeasurement";
import { MemoryStats } from "./MemoryStats";
import { PointMeasurement } from "./tools/annotation/measure/PointMeasurement";
import { flyToTileset } from "./construkted";
import { AssetExplorerV2 } from "./AssetExplorerV2";

interface ConstruktedConstructorOptions {
    ajax: ParsedConstruktedAjax;
}
export default class Construkted {
    public readonly util: Util;

    // eslint-disable-next-line no-use-before-define
    private static _instance: Construkted;
    private readonly _navigationHelper: NavigationHelper;

    private readonly _construktedAjax: ParsedConstruktedAjax;
    private readonly _viewer: AssetViewer | ProjectViewer | OrthomosaicViewer | AssetExplorerV2 | undefined;
    private _autoFlyToAsset: boolean = true;
    private readonly _layersPanel: LayersPanel;
    pickGlobeDebugger: PickGlobeDegugger;
    private readonly _hullCalculator: HullCalculator;

    private readonly _measurementTools: MeasurementTools;
    private readonly _drawingTools: DrawingTools;
    private readonly _clippingTools: ClippingTools;

    private readonly _canvasEventHandler: CanvasEventHandler;
    private _mapTool: MapTool | undefined;
    private readonly _imagePlaneEditTool: ImagePlaneEditTool;
    private readonly _polygonEditTool: PolygonEditTool;
    private readonly _polylineEditTool: PolylineEditTool;
    private readonly _distanceMeasurementEditTool: DistanceMeasurementEditTool;
    private readonly _noteEditTool: NoteEditTool;
    private readonly _pointMeasurementEditTool: PointMeasurementEditTool;
    private readonly _project: Project;
    private readonly _labelService: LabelService;
    private readonly _crsManager = new CRSManager();

    private readonly _assetViewerCreated = new Event();

    constructor(options: ConstruktedConstructorOptions) {
        Construkted._instance = this;
        window.Construkted = this;

        this.util = new Util();

        const ajax = options.ajax;
        this._construktedAjax = ajax;

        if (this.isTilesetAsset()) {
            this._viewer = new AssetViewer({
                construktedAjax: ajax
            });

            window.construktedAssetViewer = this._viewer;

            this._assetViewerCreated.raiseEvent();
        } else if (this.isProject()) {
            if (window.master_asset) {
                // old project
                window.master_asset = parseAssetInfo(window.master_asset as unknown as RawAssetInfo);
            }

            const assetInfos: AssetInfo[] = [];

            window.assets.forEach((assetInfo) => {
                assetInfos.push(parseAssetInfo(assetInfo as unknown as RawAssetInfo));
            });

            window.assets = assetInfos;

            const assetInfos1: AssetInfo[] = [];

            window.project_assets.forEach((assetInfo) => {
                assetInfos1.push(parseAssetInfo(assetInfo as unknown as RawAssetInfo));
            });

            window.project_assets = assetInfos1;

            this._viewer = new ProjectViewer({
                construktedAjax: ajax
            });
        } else if (this.isOrthomosaic()) {
            this._viewer = new OrthomosaicViewer({
                construktedAjax: ajax
            });
        } else {
            this._viewer = new AssetExplorerV2({
                construktedAjax: ajax
            });

            window.construktedAssetExplorer = this._viewer;
        }

        this._layersPanel = new LayersPanel();

        const viewer = this.cesiumViewer;

        /*
        window.videoRecorderWidget = new VideoRecorderWidget({
            videoRecorder: new VideoRecorder({
                viewer: viewer
            })
        });

        window.videoRecorderWidget.hide();
        */

        this.pickGlobeDebugger = new PickGlobeDegugger(viewer);

        this._hullCalculator = new HullCalculator();

        this._canvasEventHandler = new CanvasEventHandler({
            parent: this,
            scene: this.scene
        });

        this._canvasEventHandler.activate();

        this._drawingTools = new DrawingTools({
            parent: this,
            viewer: viewer
        });

        this._measurementTools = new MeasurementTools({
            parent: this,
            viewer: viewer,
            units: new MeasureUnits({
                distanceUnits: ajax.length_unit,
                areaUnits: ajax.area_unit,
                volumeUnits: ajax.volume_unit,
                angleUnits: ajax.angle_unit
            }),
            crsInfo: this._crsManager.getWGS84(),
            crsManager: this._crsManager
        });

        this._imagePlaneEditTool = new ImagePlaneEditTool({
            viewer: viewer
        });

        this._polygonEditTool = new PolygonEditTool({
            viewer: viewer
        });

        this._polylineEditTool = new PolylineEditTool({
            viewer: viewer
        });

        this._distanceMeasurementEditTool = new DistanceMeasurementEditTool({
            viewer: viewer
        });

        this._noteEditTool = new NoteEditTool({
            viewer: viewer
        });

        this._pointMeasurementEditTool = new PointMeasurementEditTool({
            viewer: viewer
        });

        this._clippingTools = new ClippingTools({
            parent: this,
            viewer: viewer
        });

        this._navigationHelper = new NavigationHelper({
            viewer: viewer
        });

        this._project = new Project();

        this._measurementTools.pointMeasurmentTool.crsInfo = this.project.crsInfo;

        // eslint-disable-next-line no-new
        new MemoryStats();

        this._labelService = new LabelService(window.Construkted.cesiumViewer);
    }

    static instance() {
        return Construkted._instance;
    }

    // eslint-disable-next-line class-methods-use-this
    currentUserIsAuthor() {
        if (window.currentUser) {
            return window.currentUser.is_author === "true";
        }

        return window.CONSTRUKTED_AJAX.is_owner;
    }

    isAssetExplorer() {
        return this._construktedAjax.ajax_type === ConstruktedAjaxType.AssetExplorerV2;
    }

    isTilesetAsset() {
        const construktedAjax = this._construktedAjax;

        if (!construktedAjax.post_slug) {
            // asset explorer
            return false;
        }

        if (construktedAjax.post_slug[0] === "p") {
            // project
            return false;
        }

        if (construktedAjax.asset_type === ConstruktedAssetType.Orthomosaic) {
            // orthomosaic
            return false;
        }

        return true;
    }

    isProject() {
        const construktedAjax = this._construktedAjax;

        if (!construktedAjax.post_slug) {
            // asset explorer
            return false;
        }

        return construktedAjax.post_slug[0] === "p";
    }

    isOrthomosaic() {
        return this._construktedAjax.asset_type === ConstruktedAssetType.Orthomosaic;
    }

    removeTileset(tileset: Cesium3DTileset) {
        return this.cesiumViewer.scene.primitives.remove(tileset);
    }

    getTilesetByUrl(url: string) {
        const primitives = this.cesiumViewer!.scene.primitives;

        for (let i = 0; i < primitives.length; ++i) {
            const p = primitives.get(i);

            if (p._url === url) {
                return p;
            }
        }

        return undefined;
    }

    getAsset(postId: string) {
        return this.projectViewer.projectAssetGroup.getAsset(postId);
    }

    getTilesetAsset(postId: string) {
        if (this.isProject()) {
            return this.projectViewer.projectAssetGroup.getTilesetAsset(postId);
        }

        if (this.isTilesetAsset()) {
            if (this.assetViewer.masterAsset.postId !== postId) {
                throw new Error("error");
            }

            return this.masterAsset;
        }

        throw new Error("error");
    }

    get scene() {
        return this.cesiumViewer!.scene;
    }

    get autoZoomToAsset() {
        return this._autoFlyToAsset;
    }

    set autoZoomToAsset(val: boolean) {
        this._autoFlyToAsset = val;
    }

    get masterAsset() {
        return this.assetViewer.masterAsset;
    }

    get projectAssetGroup() {
        return this.projectViewer.projectAssetGroup;
    }

    get camera() {
        return this.cesiumViewer?.camera as Camera;
    }

    get cesiumViewer() {
        return this._viewer?.cesiumViewer as Viewer;
    }

    get viewer() {
        return this._viewer;
    }

    get assetViewer() {
        return this._viewer as AssetViewer;
    }

    get projectViewer() {
        console.assert(this.isProject(), "error");

        return this._viewer as ProjectViewer;
    }

    get orthomoisaicViewer() {
        return this._viewer as OrthomosaicViewer;
    }

    get fpvController() {
        return this._viewer!.fpvController;
    }

    get flyController() {
        return this._viewer!.flyController;
    }

    get layersPanel() {
        return this._layersPanel;
    }

    setSceneBackgroundColor(cssColor: string) {
        this._viewer!.setSceneBackgroundColor(cssColor);
    }

    showHideSceneBackground(show: boolean) {
        this._viewer!.showHideSceneBackground(show);
    }

    addGoogleSatelliteMap() {
        this._viewer?.addGoogleSatelliteMap();

        if (this.isOrthomosaic()) {
            const asset = this.orthomoisaicViewer.asset;

            this.orthomoisaicViewer.addTMSTilesImageryLayer(asset.tmsURL, asset.rectangle);
        } else if (this.isProject()) {
            const tmsTilesAssets = this.projectViewer.projectAssetGroup.tmsTilesAssets;

            tmsTilesAssets.forEach((asset) => {
                this.projectViewer.addTMSTilesImageryLayer(asset.tmsURL, asset.rectangle);
            });
        }
    }

    addGoogleHybridMap() {
        this._viewer?.addGoogleHybridMap();

        if (this.isOrthomosaic()) {
            const asset = this.orthomoisaicViewer.asset;

            this.orthomoisaicViewer.addTMSTilesImageryLayer(asset.tmsURL, asset.rectangle);
        } else if (this.isProject()) {
            const tmsTilesAssets = this.projectViewer.projectAssetGroup.tmsTilesAssets;

            tmsTilesAssets.forEach((asset) => {
                this.projectViewer.addTMSTilesImageryLayer(asset.tmsURL, asset.rectangle);
            });
        }
    }

    addGoogleRoadMap() {
        this._viewer?.addGoogleRoadMap();

        if (this.isOrthomosaic()) {
            const asset = this.orthomoisaicViewer.asset;

            this.orthomoisaicViewer.addTMSTilesImageryLayer(asset.tmsURL, asset.rectangle);
        } else if (this.isProject()) {
            const tmsTilesAssets = this.projectViewer.projectAssetGroup.tmsTilesAssets;

            tmsTilesAssets.forEach((asset) => {
                this.projectViewer.addTMSTilesImageryLayer(asset.tmsURL, asset.rectangle);
            });
        }
    }

    // ajax

    // eslint-disable-next-line class-methods-use-this
    saveSceneBackgroundColor(cssColor: string) {
        saveSceneBackgroundColor(cssColor);
    }

    flyToAsset() {
        if (this.isTilesetAsset()) {
            this.camera.flyToBoundingSphere(this.masterAsset.tileset.boundingSphere);
        } else if (this.isProject()) {
            this.camera.flyToBoundingSphere(this.projectAssetGroup.boundingSphere);
        }
    }

    flyToAssetByFlag() {
        if (this._autoFlyToAsset) {
            this.flyToAsset();
        }
    }

    existsPendingRequests() {
        if (this.isTilesetAsset()) {
            const asset = this.assetViewer.masterAsset;

            if (!asset?.ready) {
                return true;
            }

            const tileset = asset.tileset;

            // @ts-ignore
            return tileset._statistics.numberOfPendingRequests > 0;
        }

        if (this.isProject()) {
            const assetGroup = this.projectViewer?.projectAssetGroup;

            // If there's no asset group at all, return false since there's nothing to load
            if (!assetGroup) {
                return false;
            }

            if (!assetGroup.ready) {
                return true;
            }

            const tilesetArray = assetGroup.tilesetsArray();

            for (let i = 0; i < tilesetArray.length; i++) {
                const tileset = tilesetArray[i];

                // @ts-ignore
                if (tileset._statistics.numberOfPendingRequests > 0) {
                    return true;
                }
            }

            return false;
        }

        return false;
    }

    percentOFLoadedTiles() {
        if (this.isTilesetAsset()) {
            return this.assetViewer.masterAsset.percentOfLoadedTiles();
        }

        if (this.isProject()) {
            return this.projectViewer.projectAssetGroup.percentOfLoadedTiles();
        }

        return 100;
    }

    percentOfLoadingProgress() {
        if (this.isTilesetAsset()) {
            return this.assetViewer.masterAsset.percentOfLoadingProgress;
        }

        if (this.isProject()) {
            return this.projectViewer.projectAssetGroup.percentOfLoadingProgress();
        }

        return 100;
    }

    // eslint-disable-next-line class-methods-use-this
    isLocal() {
        const hostname = window.location.hostname;

        return hostname === "localhost" || hostname === "127.0.0.1";
    }

    imageRootUrl() {
        if (this.isLocal()) {
            if (window.location.port === "") {
                // http://localhost/gw4.construkted.com/project/przn35fma69/

                return `${window.location.protocol}//${window.location.host}/gw4.construkted.com/wp-content/themes/gowatch-child/images`;
            }

            // http://localhost:3000/
            return `/images`;
        }

        return `${window.location.protocol}//${window.location.host}/wp-content/themes/gowatch-child/images`;
    }

    assetsRootUrl() {
        if (this.isLocal()) {
            if (window.location.port === "") {
                // http://localhost/gw4.construkted.com/project/przn35fma69/

                return `${window.location.protocol}//${window.location.host}/gw4.construkted.com/wp-content/themes/gowatch-child/includes/construkted/assets`;
            }

            // http://localhost:3000/
            return "";
        }

        return `${window.location.protocol}//${window.location.host}/wp-content/themes/gowatch-child/includes/construkted/assets`;
    }

    zoomToAsset(asset: Asset) {
        const viewer = this.cesiumViewer;

        if (asset.isTileset()) {
            flyToTileset({
                viewer: viewer,
                defaultCameraPositionDirection: undefined,
                tileset: (asset as TilesetAsset).tileset
            });
        }

        if (asset.isTMSTiles()) {
            viewer.zoomTo((asset as TMSTilesAsset).imageryLayer);
        }
    }

    get tilesetAssets(): TilesetAsset[] {
        if (this.isTilesetAsset()) {
            return [this.assetViewer.masterAsset];
        }

        if (this.isProject()) {
            return this.projectViewer.projectAssetGroup.tilesetAssets;
        }

        if (this.isAssetExplorer()) {
            // For AssetExplorer, we need to create TilesetAsset objects from the loaded tilesets
            const tilesets: TilesetAsset[] = [];
            const assetExplorer = this._viewer as AssetExplorerV2;

            if (assetExplorer && assetExplorer.assetsData) {
                assetExplorer.assetsData.forEach((assetData: ParsedGlobeAssetInfo) => {
                    if (assetData.tileset && assetData.asset_geo_location) {
                        // Create a TilesetAsset from the loaded tileset data with a dummy URL to prevent loading
                        const tilesetAsset = new TilesetAsset({
                            type: ConstruktedAssetType.ThreeDTiles, // Default type
                            postId: assetData.ID.toString(),
                            scene: this.scene,
                            assetGeolocation: assetData.asset_geo_location,
                            ignore_original_transform: false,
                            tilesetUrl: "", // URL not needed as tileset is already loaded
                            ignoreRootTransform: false
                        });

                        // Set the already loaded tileset immediately
                        // @ts-ignore - Direct access to private properties for pre-loaded tileset
                        tilesetAsset._tileset = assetData.tileset;
                        // @ts-ignore - Direct access to private properties for pre-loaded tileset
                        tilesetAsset._ready = true;

                        tilesets.push(tilesetAsset);
                    }
                });
            }

            return tilesets;
        }

        throw new DeveloperError("should not be reached!");
    }

    get tilesetAssetGroup() {
        if (this.isTilesetAsset()) {
            return new TilesetAssetGroup({
                assets: [this.assetViewer.masterAsset]
            });
        }

        if (this.isProject()) {
            return new TilesetAssetGroup({
                assets: this.projectViewer.projectAssetGroup.tilesetAssets
            });
        }

        throw new DeveloperError("should not be reached!");
    }

    set3DViewMode() {
        this._viewer?.setViewMode(ViewModes.ThreeD);
    }

    set2DViewMode() {
        this._viewer?.setViewMode(ViewModes.TwoD);
    }

    set2DViewNorthUpMode() {
        this._viewer?.setViewMode(ViewModes.TwoDNorthUp);
    }

    setWireframeShadingMode() {
        const tilesetAssets = this.tilesetAssets;

        tilesetAssets.forEach((asset) => {
            asset.setShadingMode(TilesetAssetShadingModes.Wireframe);
        });

        // Also apply to twin viewer assets if twin view mode is active
        if (this.isProject() && this.projectViewer.isTwinViewMode()) {
            const twinAssets = this.projectViewer.twinViewerAsswetGroup?.tilesetAssets || [];
            twinAssets.forEach((asset) => {
                asset.setShadingMode(TilesetAssetShadingModes.Wireframe);
            });
        }
    }

    setSolidShadingMode() {
        const tilesetAssets = this.tilesetAssets;

        tilesetAssets.forEach((asset) => {
            asset.setShadingMode(TilesetAssetShadingModes.Solid);
        });

        if (this.isProject() && this.projectViewer.isTwinViewMode()) {
            const twinAssets = this.projectViewer.twinViewerAsswetGroup?.tilesetAssets || [];
            twinAssets.forEach((asset) => {
                asset.setShadingMode(TilesetAssetShadingModes.Solid);
            });
        }
    }

    setTextureShadingMode() {
        const tilesetAssets = this.tilesetAssets;

        tilesetAssets.forEach((asset) => {
            asset.setShadingMode(TilesetAssetShadingModes.Texture);
        });

        if (this.isProject() && this.projectViewer.isTwinViewMode()) {
            const twinAssets = this.projectViewer.twinViewerAsswetGroup?.tilesetAssets || [];
            twinAssets.forEach((asset) => {
                asset.setShadingMode(TilesetAssetShadingModes.Texture);
            });
        }
    }

    setBackfaceCulling(b: boolean) {
        const tilesetAssets = this.tilesetAssets;

        tilesetAssets.forEach((asset) => {
            const tileset = asset.tileset;

            tileset.backFaceCulling = b;
        });

        this.scene.requestRender();
    }

    setEnableCollisionDetection(b: boolean) {
        this.scene.screenSpaceCameraController.enableCollisionDetection = b;
    }

    get hullCalculator() {
        return this._hullCalculator;
    }

    computeHullAndClipTerrain() {
        const masterAsset = this.assetViewer.masterAsset;
        const tileset = masterAsset.tileset;
        const url = tileset.resource.url;
        let rotationMatrix;

        if (!masterAsset.originallyGeoreferencedAtECEF) {
            const hpr = masterAsset.hpr;

            const quaternion = Quaternion.fromHeadingPitchRoll(hpr);
            const rotation3 = Matrix3.fromQuaternion(quaternion);

            rotationMatrix = Matrix4.fromRotation(rotation3);
        }

        const position = masterAsset.position;
        const scaleMatrix = Matrix4.fromScale(masterAsset.scale);
        const translationMatrix = Transforms.eastNorthUpToFixedFrame(position);
        const toWorld = Matrix4.multiply(translationMatrix, scaleMatrix, new Matrix4());

        const reference = masterAsset.getRefereceFrame(new Matrix4());
        const invReference = Matrix4.inverse(reference, new Matrix4());
        const localToWorld = masterAsset.localToWorldMatrix(new Matrix4());

        this._hullCalculator!.computeHullMatrix(url, rotationMatrix).then((hull: any) => {
            hull.forEach((cartesian: Cartesian3) => {
                if (!masterAsset.originallyGeoreferencedAtECEF) {
                    Matrix4.multiplyByPoint(toWorld, cartesian, cartesian);
                } else {
                    Matrix4.multiplyByPoint(invReference, cartesian, cartesian);
                    Matrix4.multiplyByPoint(localToWorld, cartesian, cartesian);
                }
            });

            const debug = false;
            const cesiumViewer = this.assetViewer.cesiumViewer;

            if (debug) {
                const radii = 1;

                for (let i = 0; i < hull.length; ++i) {
                    cesiumViewer.entities.add({
                        position: hull[i],
                        ellipsoid: {
                            radii: new Cartesian3(radii, radii, radii),
                            material: new Color(0.95, 0.82, 0.49)
                        }
                    });
                }
            }

            this.clipTerrain(hull);
        });
    }

    clipTerrain(positions: Cartesian3[]) {
        const pointsLength = positions.length;

        // Create center points for each clipping plane
        const clippingPlanes = [];

        for (let i = 0; i < pointsLength; ++i) {
            const nextIndex = (i + 1) % pointsLength;
            let midpoint = Cartesian3.add(positions[i], positions[nextIndex], new Cartesian3());
            midpoint = Cartesian3.multiplyByScalar(midpoint, 0.5, midpoint);

            const up = Cartesian3.normalize(midpoint, new Cartesian3());
            let right = Cartesian3.subtract(positions[nextIndex], midpoint, new Cartesian3());
            right = Cartesian3.normalize(right, right);

            let normal = Cartesian3.cross(right, up, new Cartesian3());
            normal = Cartesian3.normalize(normal, normal);

            // Compute distance by pretending the plane is at the origin
            const originCenteredPlane = new Plane(normal, 0.0);
            const distance = Plane.getPointDistance(originCenteredPlane, midpoint);

            clippingPlanes.push(new ClippingPlane(normal, distance));
        }

        const globe = this.cesiumViewer.scene.globe;

        globe.clippingPlanes = new ClippingPlaneCollection({
            planes: clippingPlanes,
            edgeWidth: 1.0,
            edgeColor: Color.WHITE,
            enabled: true
        });
    }

    get mapTool() {
        return this._mapTool;
    }

    setMapTool(mapTool: MapTool | undefined, activateOptions: any = undefined) {
        if (this._mapTool && !Object.is(this._mapTool, mapTool)) {
            this._mapTool.deactivate();
        }

        if (this._mapTool && Object.is(this._mapTool, mapTool)) {
            // already activated;
            return;
        }

        this._mapTool = mapTool;

        if (mapTool) {
            mapTool.activate(activateOptions);
        }
    }

    deactivateCurrentMapTool(deactivateOptions: any = undefined) {
        if (!this._mapTool) {
            return;
        }

        this._mapTool.deactivate(deactivateOptions);

        this._mapTool = undefined;
    }

    get measurementTools() {
        return this._measurementTools;
    }

    get drawingTools() {
        return this._drawingTools;
    }

    get clippingTools() {
        return this._clippingTools;
    }

    startEditingAnnotation(id: string, mode: "create" | "edit") {
        const drawing = this._drawingTools.getDrawingById(id);

        if (drawing) {
            const drawingType = drawing.type;

            if (drawingType === DrawingType.Polygon) {
                const polygon = (drawing as PolygonDrawing).polygon;

                this.setMapTool(this._polygonEditTool, {
                    polygon: polygon
                });
            } else if (drawingType === DrawingType.Polyline) {
                const polyline = (drawing as PolylineDrawing).polyline;

                this.setMapTool(this._polylineEditTool, {
                    polyline: polyline
                });
            } else if (drawingType === DrawingType.Note) {
                this.setMapTool(this._noteEditTool, {
                    noteDrawing: drawing as NoteDrawing
                });
            } else if (drawingType === DrawingType.ImagePlane) {
                setTimeout(() => {
                    // wait until the modelMatrix of ImagePlanePrimitive become the identity matirx
                    this.setMapTool(this._imagePlaneEditTool, {
                        imagePlane: drawing as ImagePlane
                    });
                }, 100);
            }
        }

        const measurement = this._measurementTools.getMeasurmentById(id);

        if (measurement) {
            const measurementType = measurement.type;

            if (measurementType === MeasurementType.Area) {
                const polygon = (measurement as AreaMeasurement).polygon;

                this.setMapTool(this._polygonEditTool, {
                    polygon: polygon
                });
            } else if (measurementType === MeasurementType.Polyline) {
                const polyline = (measurement as PolylineMeasurement).polyline;

                this.setMapTool(this._polylineEditTool, {
                    polyline: polyline
                });
            } else if (measurementType === MeasurementType.Distance) {
                this.setMapTool(this._distanceMeasurementEditTool, {
                    distanceMeasurement: measurement as DistanceMeasurement
                });
            } else if (measurementType === MeasurementType.Volume) {
                const polygon = (measurement as VolumeMeasurement).editablePolygon;

                this.setMapTool(this._polygonEditTool, {
                    polygon: polygon
                });
            } else if (measurementType === MeasurementType.Point) {
                const point = measurement as PointMeasurement;

                this.setMapTool(this._pointMeasurementEditTool, {
                    pointMeasurement: point
                });
            }
        }

        const clippingBox = this._clippingTools.clippingBoxTool.getClippingBoxById(id);

        if (clippingBox) {
            if (mode === "edit") {
                this._clippingTools.clippingBoxTool.storeStatus();
            }

            clippingBox.showEditControls(true);
        }

        const clippingPlane = this._clippingTools.clippingPlaneTool.getClippingPlaneById(id);

        if (clippingPlane) {
            if (mode === "edit") {
                this._clippingTools.clippingPlaneTool.storeStatus();
            }

            clippingPlane.editable = true;
        }
    }

    finishedEditingAnnotation(successSaved: boolean) {
        if (!this._mapTool) {
            return;
        }

        const deactivateOptions = { normallyDeactivate: successSaved };

        this.deactivateCurrentMapTool(deactivateOptions);
    }

    get project() {
        return this._project as Project;
    }

    get labelService() {
        return this._labelService;
    }

    get imagePlaneEditTool() {
        return this._imagePlaneEditTool;
    }

    get assetViewerCreated() {
        return this._assetViewerCreated;
    }

    get crsManager() {
        return this._crsManager;
    }

    getCoordinate(carto: Cartographic, crsInfo: CRSInfo) {
        return this._crsManager.getCoordinate(carto, crsInfo);
    }
}
