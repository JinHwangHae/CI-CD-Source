/* qeslint-disable */
// q@ts-nocheck

import {
    Cartesian2,
    Cartesian3,
    Cesium3DTileset,
    Camera,
    defined,
    Entity,
    Event,
    HeadingPitchRange,
    Math as CesiumMath,
    Matrix4,
    Ray,
    ScreenSpaceEventType,
    ScreenSpaceEventHandler,
    Viewer,
    Color
} from "cesium";

import AbstractViewer, { AbstractViewerConstructorOptions, ViewModes } from "./AbstractViewer";
import { isMobile, flyToTileset } from "./construkted";
import { getAssetsAjax } from "./global";
import { AssetGroup } from "./core/AssetGroup";
import { TilesetAsset } from "./core";

const scratchLeftViewerCenter = new Cartesian3();

const SCENE_SPLIT_HANDLER = "scene-split-slider";

export default class ProjectViewer extends AbstractViewer {
    private _projectAssetGroup: AssetGroup | undefined;
    private _twinViewerAsswetGroup: AssetGroup | undefined;
    private _twinViewer: Viewer | undefined;
    private _sceneSplitSlider: HTMLElement | undefined;
    private _screenSpaceEventHandler: ScreenSpaceEventHandler | undefined;
    private _entityOrPrimitivePicked: Event;

    // twinViewMode ralative variables
    private _leftCameraChangedRemove: Event.RemoveCallback | undefined;
    private _rightCameraChangedRemove: Event.RemoveCallback | undefined;
    private _splitMoveActive: boolean = false;
    private _headingPitchRange: HeadingPitchRange = new HeadingPitchRange();
    private _leftViewerCenter: Cartesian3 | undefined;

    constructor(options: AbstractViewerConstructorOptions) {
        super(options);

        this._entityOrPrimitivePicked = new Event();
    }

    _init() {
        this._viewer = this._createCesiumViewer() as Viewer;

        this._createNavigationControlbar();

        const construktedAjax = this._construktedAjax;

        this._loadAssets();

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
                    position: new Cartesian2(touch.clientX, touch.clientY)
                });
            } else {
                console.warn("can not get position");
            }
        });

        if (!construktedAjax.embed && isMobile()) {
            this.initXR();
        }

        this._viewer.scene.globe.depthTestAgainstTerrain = construktedAjax.depth_test_against_terrain;
    }

    _loadAssets() {
        const masterAssetInfo = window.master_asset;

        if (masterAssetInfo) {
            // this is old project
            this._projectAssetGroup = new AssetGroup({
                viewer: this._viewer!,
                assetInfos: [masterAssetInfo]
            });
            this._projectAssetGroup.readEvt.addEventListener(() => {
                this._onProjectAssetsReady();
            });
        } else if (window.project_assets && window.project_assets.length > 0) {
            this._projectAssetGroup = new AssetGroup({
                viewer: this._viewer!,
                assetInfos: window.project_assets
            });
            this._projectAssetGroup.readEvt.addEventListener(() => {
                this._onProjectAssetsReady();
            });
        } else {
            // No assets case - enable sidebar and viewer immediately
            jQuery(".viewer-loading").addClass("loaded");
            jQuery("#side-menu-bar-wrapper").removeClass("disabled not-loaded");

            // Initialize an empty asset group to maintain proper state
            this._projectAssetGroup = new AssetGroup({
                viewer: this._viewer!,
                assetInfos: []
            });

            // Trigger ready state immediately since there's nothing to load
            setTimeout(() => {
                this._onProjectAssetsReady();
            }, 0);
        }
    }

    _onProjectAssetsReady() {
        const viewer = this._viewer;
        const scene = viewer!.scene;

        scene.screenSpaceCameraController.enableCollisionDetection = false;

        const projectAssetGroup = this.projectAssetGroup;
        this.showHideSceneBackground(projectAssetGroup.containsGeoreferencedAsset());

        const onFlyFinished = () => {
            jQuery(".viewer-loading").addClass("loaded");
            jQuery("#side-menu-bar-wrapper").removeClass("disabled not-loaded");
        };

        const defaultCameraPositionDirection = this._construktedAjax.default_camera_position_direction;
        const tileset = projectAssetGroup.firstTileset;

        if (defaultCameraPositionDirection && tileset) {
            scene.camera.flyHome = () => {
                flyToTileset({
                    viewer: this._viewer!,
                    tileset: tileset,
                    defaultCameraPositionDirection: defaultCameraPositionDirection,
                    complete: onFlyFinished
                });
            };

            scene.camera.flyHome();
        } else {
            const flyToAssetGroup = () => {
                const boundingSphere = projectAssetGroup.boundingSphere;

                scene.camera.flyToBoundingSphere(boundingSphere!, {
                    complete: onFlyFinished
                });
            };

            scene.camera.flyHome = () => {
                flyToAssetGroup();
            };

            flyToAssetGroup();
        }

        projectAssetGroup.assets.forEach((asset) => {
            if (asset instanceof TilesetAsset) {
                const tilesetAsset = asset as TilesetAsset;

                tilesetAsset.loadProgress.addEventListener((/* percentOfLoadingProgress */) => {
                    window.Construkted.drawingTools.updateDrawings();
                });
            }
        });
    }

    get projectAssetGroup() {
        return this._projectAssetGroup as AssetGroup;
    }

    get entityOrPrimitivePicked() {
        return this._entityOrPrimitivePicked;
    }

    _enablePicking() {
        this._screenSpaceEventHandler = new ScreenSpaceEventHandler(this._viewer!.canvas);

        this._screenSpaceEventHandler.setInputAction(
            this._onMouseLButtonClicked.bind(this),
            ScreenSpaceEventType.LEFT_DOWN
        );
    }

    _onMouseLButtonClicked(movement: { position: Cartesian2 }) {
        const pickedObject = this._viewer!.scene.pick(movement.position, 1, 1);

        const INVALID_ID = -1;

        if (!defined(pickedObject)) {
            // @ts-ignore
            this._entityOrPrimitivePicked.raiseEvent(INVALID_ID);
            return;
        }

        if (defined(pickedObject.primitive) && defined(pickedObject.id) && typeof pickedObject.id === "string") {
            this._entityOrPrimitivePicked.raiseEvent(pickedObject.id);
            return;
        }

        if (defined(pickedObject.primitive) && defined(pickedObject.id) && pickedObject.id instanceof Entity) {
            this._entityOrPrimitivePicked.raiseEvent(pickedObject.id._id);
            return;
        }

        // @ts-ignore
        this._entityOrPrimitivePicked.raiseEvent(INVALID_ID);
    }

    async searchNearAssets(searchRadius: number) {
        const ret: any[] = [];
        const jQuery = window.jQuery;

        jQuery(".ck-processing-loader").addClass("shown");

        const assetGeoLocation = this._construktedAjax.asset_geo_location;

        if (!assetGeoLocation) return false;

        const longitudeOfMainTileset = assetGeoLocation.longitude;
        const latitudeMainTileset = assetGeoLocation.latitude;
        const centerPositionOfMainTileset = Cartesian3.fromDegrees(longitudeOfMainTileset, latitudeMainTileset);
        const request = {
            action: "get_assets",
            public: jQuery("#include-public-assets").prop("checked") ? "y" : "n",
            private: jQuery("#include-private-assets").prop("checked") ? "y" : "n"
        };
        if (request.public === "n" && request.private === "n") {
            jQuery(".ck-processing-loader").removeClass("shown");
            return ret;
        }

        const theAssets = await getAssetsAjax(request);

        const CONSTRUKTED_AJAX = this._construktedAjax;

        if (theAssets.status === 200 && theAssets.data) {
            theAssets.data.forEach((assetData: any) => {
                if (CONSTRUKTED_AJAX.post_slug === assetData.post_slug) return;
                if (!assetData.asset_geo_location) return;

                // If this is a project we need to check if current ID is not in the array
                let exists = false;

                if (parseInt(assetData.post_id, 10) === parseInt(window.master_asset!.post_id, 10)) {
                    exists = true;
                }

                if (window.assets.length > 0) {
                    window.assets.forEach((projectAsset: any) => {
                        if (parseInt(projectAsset.post_id, 10) === parseInt(assetData.post_id, 10)) {
                            exists = true;
                        }
                    });
                }

                if (!exists) {
                    const assetGeoLocationData = JSON.parse(assetData.asset_geo_location);

                    const longitude = parseFloat(assetGeoLocationData.longitude);
                    const latitude = parseFloat(assetGeoLocationData.latitude);
                    const centerPositionOfTileset = Cartesian3.fromDegrees(longitude, latitude);
                    const distance = Cartesian3.distance(centerPositionOfMainTileset, centerPositionOfTileset);

                    if (distance <= searchRadius) {
                        const tileset = this._addTileset(assetData);

                        // @ts-ignore
                        tileset.show = false;

                        assetData.distance = distance;
                        assetData.tileset = tileset;

                        ret.push(assetData);
                    }
                }
            });

            jQuery(".ck-processing-loader").removeClass("shown");
        }

        return ret;
    }

    // eslint-disable-next-line class-methods-use-this
    async _addTileset(assetData: any) {
        // need to implement
        console.info(assetData);

        const tileset = await Cesium3DTileset.fromUrl("");

        return tileset;
    }

    _createSplitHandler() {
        const slider = document.createElement("div");

        slider.id = SCENE_SPLIT_HANDLER;

        slider.style.position = "absolute";
        slider.style.top = "0px";
        slider.style.left = "50%";
        slider.style.backgroundColor = "#d3d3d3";
        slider.style.width = "5px";
        slider.style.height = "100%";
        slider.style.zIndex = "9999";

        const circle = document.createElement("div");
        circle.classList.add("circle");

        slider.append(circle);

        const viewer = this._viewer as Viewer;

        viewer.container.append(slider);

        const self = this;

        function move(movement: { startPosition: Cartesian2; endPosition: Cartesian2 }) {
            if (!self._splitMoveActive) {
                return;
            }

            if (self.isTwinViewMode() && !self._leftViewerCenter) {
                return;
            }

            const relativeOffset = movement.endPosition.x;
            const splitPosition = (slider.offsetLeft + relativeOffset) / slider.parentElement!.offsetWidth;
            slider!.style.left = `${100.0 * splitPosition}%`;
            self._onSplitPositionChanged(splitPosition);
        }

        // @ts-ignore
        const handler = new ScreenSpaceEventHandler(slider);

        handler.setInputAction(() => {
            this._splitMoveActive = true;
            const camera = this._viewer!.camera;

            // @ts-ignore
            const y = this._viewer!._element.offsetHeight / 2;

            const centerOfLeftViewScreen = new Cartesian2(slider!.offsetLeft / 2, y);

            this._leftViewerCenter = this._viewer?.scene.pickPosition(centerOfLeftViewScreen, scratchLeftViewerCenter);

            if (!this._leftViewerCenter) {
                Cartesian3.clone(this._projectAssetGroup?.boundingSphere.center!, scratchLeftViewerCenter);
                this._leftViewerCenter = scratchLeftViewerCenter;
            }

            const distance = Cartesian3.distance(this._leftViewerCenter!, camera.positionWC);

            this._headingPitchRange.heading = camera.heading;
            this._headingPitchRange.pitch = camera.pitch;
            this._headingPitchRange.range = distance;
        }, ScreenSpaceEventType.LEFT_DOWN);

        handler.setInputAction(move, ScreenSpaceEventType.MOUSE_MOVE);

        handler.setInputAction(() => {
            this._splitMoveActive = false;
        }, ScreenSpaceEventType.LEFT_UP);

        this._sceneSplitSlider = slider;
    }

    // eslint-disable-next-line class-methods-use-this
    _showSplitHander() {
        const slider = document.getElementById(SCENE_SPLIT_HANDLER);

        if (slider) {
            slider.style.left = "50%";
            slider.style.display = "block";
        }
    }

    // eslint-disable-next-line class-methods-use-this
    _hideSplitHander() {
        const slider = document.getElementById(SCENE_SPLIT_HANDLER);

        if (slider) {
            slider.style.display = "none";
        }
    }

    enterCompareViewMode() {
        // https://sandcastle.cesium.com/?src=3D%20Tiles%20Compare.html

        if (!this._sceneSplitSlider) {
            this._createSplitHandler();
        }

        this._viewer!.scene.splitPosition = 0.5;

        this._showSplitHander();
    }

    // eslint-disable-next-line class-methods-use-this
    leaveCompareViewMode() {
        this._hideSplitHander();
        this._viewer!.scene.splitPosition = 0;
    }

    _setTwinViewCameras(center: Cartesian3, offset: HeadingPitchRange) {
        // from threejs Ray.closestPointToPoint
        function closestPointToPoint(ray: Ray, point: Cartesian3, target: Cartesian3) {
            Cartesian3.subtract(point, ray.origin, target);

            const directionDistance = Cartesian3.dot(target, ray.direction);

            if (directionDistance < 0) {
                return Cartesian3.clone(ray.origin, target);
            }

            Cartesian3.clone(ray.origin, target);

            target.x += ray.direction.x * directionDistance;
            target.y += ray.direction.y * directionDistance;
            target.z += ray.direction.z * directionDistance;

            return target;
        }

        function setCamera(
            camera: Camera,
            targetWorld: Cartesian3,
            targetScreenPosition: Cartesian2,
            offset1: HeadingPitchRange
        ) {
            camera.lookAt(targetWorld, offset1);
            camera.lookAtTransform(Matrix4.IDENTITY);

            const ray = camera.getPickRay(targetScreenPosition);

            const target = closestPointToPoint(ray!, targetWorld, new Cartesian3());

            Cartesian3.subtract(target, targetWorld, target);

            const newPosition = Cartesian3.subtract(camera.position, target, new Cartesian3());

            camera.position = newPosition;
        }

        const leftCamera = this._viewer?.camera;
        const rightCamera = this._twinViewer?.camera;

        const slider = this._sceneSplitSlider;

        // @ts-ignore
        const y = this._viewer!._element.offsetHeight / 2;

        const targetPixelLeft = new Cartesian2(slider!.offsetLeft / 2, y);

        setCamera(leftCamera!, center, targetPixelLeft, offset);

        // @ts-ignore
        const targetPixelRight = new Cartesian2((this._viewer!._element.offsetWidth - slider!.offsetLeft) / 2, y);

        setCamera(rightCamera!, center, targetPixelRight, offset);
    }

    enterTwinViewMode() {
        if (!this._sceneSplitSlider) {
            this._createSplitHandler();
        }

        // @ts-ignore
        const leftViewerElement: HTMLElement = this._viewer!._element;

        leftViewerElement.style.position = "absolute";

        this._twinViewer = this._createCesiumViewer();

        // @ts-ignore
        const rightViewerElement: HTMLElement = this._twinViewer._element;

        rightViewerElement.style.left = "50%";
        rightViewerElement.style.position = "absolute";

        // Ensure right scene visual state matches left scene (background/globe visibility and color)
        try {
            const leftScene = this._viewer!.scene;
            const rightScene = this._twinViewer!.scene;

            rightScene.globe.show = leftScene.globe.show;
            rightScene.skyAtmosphere.show = leftScene.skyAtmosphere.show;
            rightScene.skyBox.show = leftScene.skyBox.show;
            rightScene.moon.show = leftScene.moon.show;
            rightScene.sun.show = leftScene.sun.show;

            // Copy current background color exactly
            // @ts-ignore
            rightScene.backgroundColor =
                leftScene.backgroundColor && leftScene.backgroundColor.clone
                    ? leftScene.backgroundColor.clone()
                    : Color.BLACK.clone();
        } catch (e) {
            // no-op if any element not ready
        }

        const masterAssetInfo = window.master_asset;
        const twinViewerScene = this._twinViewer!.scene;

        let twinViewerProjectAssetGroup;

        this._projectAssetGroup?.assets.forEach((asset) => {
            asset.resetShowSplitDirection();
        });

        if (masterAssetInfo) {
            // this is old project
            twinViewerProjectAssetGroup = new AssetGroup({
                viewer: this._twinViewer,
                assetInfos: [masterAssetInfo]
            });
        } else {
            twinViewerProjectAssetGroup = new AssetGroup({
                viewer: this._twinViewer,
                assetInfos: window.project_assets
            });
        }

        this._twinViewerAsswetGroup = twinViewerProjectAssetGroup;

        twinViewerProjectAssetGroup.readEvt.addEventListener(() => {
            function cameraCopy(srcCamera: Camera, destCamera: Camera) {
                destCamera.setView({
                    destination: srcCamera.position,
                    orientation: {
                        heading: srcCamera.heading,
                        pitch: srcCamera.pitch,
                        roll: srcCamera.roll
                    }
                });
            }

            const leftCamera = this._viewer?.camera!;
            const rightCamera = this._twinViewer?.camera!;

            leftCamera.percentageChanged = 0.001;
            rightCamera.percentageChanged = 0.001;

            cameraCopy(leftCamera, rightCamera);

            let rightCameraInit = false;

            const initCameras = () => {
                const center = this._projectAssetGroup?.boundingSphere.center;
                const camera = this._viewer?.camera;

                const offset = new HeadingPitchRange(
                    camera?.heading,
                    camera?.pitch,
                    camera?.positionCartographic.height
                );

                this._showSplitHander();
                this._setTwinViewCameras(center!, offset);
                rightCameraInit = true;
            };

            // If globe is hidden, tiles won't load; initialize cameras immediately
            if (!twinViewerScene.globe.show) {
                initCameras();
            } else {
                const tileLoadProgressEventRemove = twinViewerScene.globe.tileLoadProgressEvent.addEventListener(() => {
                    if (twinViewerScene.globe.tilesLoaded) {
                        initCameras();
                        tileLoadProgressEventRemove();
                    }
                });
            }

            this._leftCameraChangedRemove = leftCamera.changed.addEventListener(() => {
                if (this._splitMoveActive) {
                    return;
                }

                if (!rightCameraInit) {
                    return;
                }

                cameraCopy(leftCamera, rightCamera);
            });

            this._rightCameraChangedRemove = rightCamera.changed.addEventListener(() => {
                if (this._splitMoveActive) {
                    return;
                }

                if (!rightCameraInit) {
                    return;
                }

                cameraCopy(rightCamera, leftCamera);
            });
        });
    }

    leaveTwinViewMode() {
        this._viewer!.camera.percentageChanged = 0.5; // default

        // @ts-ignore
        const leftViewerElement: HTMLElement = this._viewer!._element;

        leftViewerElement.style.position = "relative";

        const container = this._viewer?.container;
        // @ts-ignore
        const rightViewerElement: HTMLElement = this._twinViewer._element;

        container?.removeChild(rightViewerElement);

        if (this._leftCameraChangedRemove) {
            this._leftCameraChangedRemove();
            this._leftCameraChangedRemove = undefined;
        }

        if (this._rightCameraChangedRemove) {
            this._rightCameraChangedRemove();
            this._rightCameraChangedRemove = undefined;
        }

        this._twinViewer = undefined;
        this._twinViewerAsswetGroup = undefined;
        this._hideSplitHander();
    }

    getTwinTilesetByUrl(url: string) {
        const primitives = this._twinViewer!.scene.primitives;

        for (let i = 0; i < primitives.length; ++i) {
            const p = primitives.get(i);

            if (p._url === url) {
                return p;
            }
        }

        return undefined;
    }

    isTwinViewMode() {
        return this._twinViewer !== undefined;
    }

    isCompareViewMode() {
        return this._viewer?.scene.splitPosition !== 0.0;
    }

    /**
     * @param splitPosition (0 ~ 1 )
     */
    _onSplitPositionChanged(splitPosition: number) {
        const viewer = this._viewer;

        if (this.isCompareViewMode()) {
            // @ts-ignore
            viewer.scene.splitPosition = splitPosition;
        } else if (this.isTwinViewMode()) {
            // @ts-ignore
            const rightViewerElement: HTMLElement = this._twinViewer._element;
            rightViewerElement.style.left = `${100 * splitPosition}%`;

            this._setTwinViewCameras(this._leftViewerCenter!, this._headingPitchRange);
        }
    }

    get twinViewerAsswetGroup() {
        return this._twinViewerAsswetGroup;
    }

    // propagate background color changes to the twin viewer as well
    setSceneBackgroundColor(cssColor: string) {
        super.setSceneBackgroundColor(cssColor);

        if (this._twinViewer) {
            try {
                this._twinViewer.scene.backgroundColor = Color.fromCssColorString(cssColor);
            } catch (e) {
                // ignore
            }
        }
    }

    // propagate show/hide of scene background (globe/sky) to the twin viewer
    showHideSceneBackground(show: boolean) {
        super.showHideSceneBackground(show);

        if (this._twinViewer) {
            const scene = this._twinViewer.scene;
            scene.globe.show = show;
            scene.skyAtmosphere.show = show;
            scene.skyBox.show = show;
            scene.moon.show = show;
            scene.sun.show = show;

            if (show) scene.backgroundColor = Color.BLACK.clone();
            else scene.backgroundColor = Color.fromCssColorString(window.CONSTRUKTED_AJAX.bg_color_css_string);
        }
    }

    setViewMode(mode: ViewModes) {
        super.setViewMode(mode);

        const viewer = this._viewer!;
        const camera = viewer.camera;
        const scene = viewer.scene;

        const boundingSphere = this._projectAssetGroup?.boundingSphere!;

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
