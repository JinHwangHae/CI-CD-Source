/* qeslint-disable */
// q@ts-nocheck

import {
    ArcType,
    Cartographic,
    Cartesian3,
    Color,
    DebugModelMatrixPrimitive,
    Ellipsoid,
    Entity,
    Event,
    HeadingPitchRoll,
    Math as CesiumMath,
    Matrix4,
    PolylineArrowMaterialProperty,
    Transforms,
    Viewer
} from "cesium";

import AssetViewer from "../AssetViewer";
import AutoOrientationMouseHandler from "./AutoOrientationMouseHandler";
import AutoScaleMouseHandler from "./AutoScaleMouseHandler";
import { VisualPositionEditorUI } from "./VisualPositionEditorUI";
import GeolocationRefMouseHandler from "./GeolocationRefMouseHandler";
import { AssetGeoLocation } from "../types/common";
import TransformEditor from "./TransformEditor/TransformEditor";
import { EditorMode } from "./TransformEditor/TransformEditorViewModel";

interface VisualPositionEditorConstructorOptions {
    assetViewer: AssetViewer;
}

interface ActivateOptions {
    activateTransformEditor: boolean;
    geolocation: AssetGeoLocation | undefined;
    terrainImageryEnabled: boolean;
}

interface deactivateOptions {
    geolocation: AssetGeoLocation | undefined;
    terrainImageryEnabled: boolean;
}

const _onPositionChangedCartoScratch: Cartographic = new Cartographic();

export class VisualPositionEditor {
    private readonly _ui: VisualPositionEditorUI;

    private readonly _assetViewer: AssetViewer;
    private _transformEditor: TransformEditor;
    private _geolocationRefMouseHandler: GeolocationRefMouseHandler;

    private _debug: boolean;
    private readonly _autoOrientationMouseHandler: AutoOrientationMouseHandler;
    private readonly _autoScaleMouseHandler: AutoScaleMouseHandler;

    private _frame: DebugModelMatrixPrimitive | undefined;
    private _normalArrow: Entity | undefined;
    private _rotatedNormalArrow: Entity | undefined;
    private _deactivated: Event = new Event();
    private _ignoreOnPositionChanged: boolean = false;
    private _ignoreOnHeadingPitchRollChanged: boolean = false;
    private _ignoreOnScaleChanged: boolean = false;
    private _listenGeoRefChanged = true;

    constructor(options: VisualPositionEditorConstructorOptions) {
        this._debug = false;

        this._assetViewer = options.assetViewer;
        const viewer = this._assetViewer.cesiumViewer as Viewer;
        const asset = this._assetViewer.masterAsset;

        asset.positionChanged.addEventListener(this._onPositionChangedAtAsset.bind(this));

        this._transformEditor = new TransformEditor({
            container: viewer.container,
            scene: viewer.scene,
            transform: Matrix4.IDENTITY.clone(new Matrix4()),
            boundingSphere: asset.tightBoundingSphere
        });

        this._geolocationRefMouseHandler = new GeolocationRefMouseHandler(viewer.scene);

        this._geolocationRefMouseHandler.pointSelected.addEventListener((position: Cartesian3) => {
            if (this.active) {
                // visual location editor

                this._listenGeoRefChanged = true;
                asset.setGeoRef(position, false);
            } else {
                // predefined editor
                // asset.updateGeoRefByPosition(position, false);

                this._listenGeoRefChanged = false;
                asset.setGeoRef(position, true);
            }

            window.Construkted.flyToAssetByFlag();
        });

        asset.geoRefChanged.addEventListener((pos: Cartesian3) => {
            if (!this._listenGeoRefChanged) {
                return;
            }

            this.geolocationRefMouseHandler.updateRefPointPosition(pos);

            this._ignoreOnPositionChanged = true;
            this._transformEditor.viewModel.position = pos;
            this._ignoreOnPositionChanged = false;
        });

        asset.elevationRefChanged.addEventListener((pos: Cartesian3) => {
            this.geolocationRefMouseHandler.updateRefPointPosition(pos);
        });

        this._ui = new VisualPositionEditorUI({
            visualPositionEditor: this
        });

        const viewModel = this._transformEditor.viewModel;

        viewModel.positionChanged.addEventListener(this._onPositionChanged.bind(this));
        viewModel.headingPitchRollChanged.addEventListener(this._onHeadingPitchRollChanged.bind(this));
        viewModel.scaleChanged.addEventListener(this._onScaleChanged.bind(this));

        this._transformEditor.hideMenu();

        if (this._debug) {
            this._addDebugAxes();
        }

        document.addEventListener("keydown", this._onKeyDown.bind(this));

        this._autoOrientationMouseHandler = new AutoOrientationMouseHandler({ scene: viewer.scene, asset: asset });

        this._autoOrientationMouseHandler.preparedThreePoints.addEventListener(
            this._onPreparedThreePointsForAutoRotation.bind(this)
        );

        this._autoScaleMouseHandler = new AutoScaleMouseHandler(viewer.scene);

        this._autoScaleMouseHandler.preparedTwoPoints.addEventListener(
            this._onPreparedTwoPointsForAutoScale.bind(this)
        );
    }

    get assetViewer() {
        return this._assetViewer;
    }

    get active() {
        return this._transformEditor.viewModel.activeTranslationAndRotation;
    }

    get autoOrientationMouseHandler() {
        return this._autoOrientationMouseHandler;
    }

    get autoScaleMouseHandler() {
        return this._autoScaleMouseHandler;
    }

    get transformEditor() {
        return this._transformEditor;
    }

    set heading(heading: number) {
        const transformEditor = this._transformEditor;
        const viewModel = transformEditor.viewModel;

        const headingPitchRoll = HeadingPitchRoll.clone(viewModel.headingPitchRoll);

        headingPitchRoll.heading = CesiumMath.toRadians(heading);

        viewModel.headingPitchRoll = headingPitchRoll;
    }

    set pitch(pitch: number) {
        const transformEditor = this._transformEditor;
        const viewModel = transformEditor.viewModel;

        const headingPitchRoll = HeadingPitchRoll.clone(viewModel.headingPitchRoll);

        headingPitchRoll.pitch = CesiumMath.toRadians(pitch);

        viewModel.headingPitchRoll = headingPitchRoll;
    }

    set roll(roll: number) {
        const transformEditor = this._transformEditor;
        const viewModel = transformEditor.viewModel;

        const headingPitchRoll = HeadingPitchRoll.clone(viewModel.headingPitchRoll);

        headingPitchRoll.roll = CesiumMath.toRadians(roll);

        viewModel.headingPitchRoll = headingPitchRoll;
    }

    get geolocationRefMouseHandler() {
        return this._geolocationRefMouseHandler;
    }

    get ui() {
        return this._ui;
    }

    activate(options: ActivateOptions) {
        const assetViewer = this._assetViewer;
        const asset = assetViewer.masterAsset;

        if (options.geolocation) {
            const geolocation = options.geolocation;

            asset.georeference(geolocation);
            assetViewer.groundPlane.setGeolocation(geolocation);

            window.Construkted.flyToAssetByFlag();
        }

        if (asset.hasValidGeoRef()) {
            this.geolocationRefMouseHandler.showRefPoint();
        }

        assetViewer.showHideSceneBackground(options.terrainImageryEnabled);
        assetViewer.groundPlane.show = !options.terrainImageryEnabled;
        const viewModel = this._transformEditor.viewModel;

        this._ignoreOnPositionChanged = true;
        this._ignoreOnHeadingPitchRollChanged = true;
        this._ignoreOnScaleChanged = true;

        if (asset.hasValidGeoRef()) {
            viewModel.position = asset.geoRef;
        } else {
            viewModel.position = asset.tightBoundingSphere.center;
        }

        viewModel.headingPitchRoll = asset.hpr;
        viewModel.scale = asset.scale;

        this._ignoreOnPositionChanged = false;
        this._ignoreOnHeadingPitchRollChanged = false;
        this._ignoreOnScaleChanged = false;

        if (options.activateTransformEditor) {
            if (!options.geolocation && !asset.originallyGeoreferencedAtECEF) {
                viewModel.activate();
                viewModel.editorMode = EditorMode.ROTATION;
                this._transformEditor.hideMenu();
            } else {
                viewModel.activateTranslationAndRotationMode();
            }
        }
    }

    deactivate(options: deactivateOptions) {
        const assetViewer = this._assetViewer;
        const asset = assetViewer.masterAsset;

        if (options.geolocation) {
            asset.georeference(options.geolocation);

            window.Construkted.flyToAssetByFlag();
        } else {
            asset.initialGeoreference();
        }

        assetViewer.showHideSceneBackground(options.terrainImageryEnabled);
        assetViewer.groundPlane.show = false;
        this._geolocationRefMouseHandler.deactivate();

        const viewModel = this._transformEditor.viewModel;

        viewModel.deactivate();

        if (this._debug) {
            const viewer = assetViewer.cesiumViewer as Viewer;

            if (this._normalArrow) {
                viewer.entities.remove(this._normalArrow);
            }

            if (this._rotatedNormalArrow) {
                viewer.entities.remove(this._rotatedNormalArrow);
            }

            this._autoOrientationMouseHandler.clear();
        }

        this._deactivated.raiseEvent();
    }

    get deactivated() {
        return this._deactivated;
    }

    resetRotationAndScale() {
        const viewModel = this._transformEditor.viewModel;

        viewModel.headingPitchRoll = new HeadingPitchRoll();
        viewModel.scale = new Cartesian3(1, 1, 1);
    }

    _showRotationControl() {
        const CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;
        const transformEditorViewModel = this._transformEditor.viewModel;

        if (!CONSTRUKTED_AJAX.terrain_imagery_enabled) {
            transformEditorViewModel.activate();
            transformEditorViewModel.editorMode = EditorMode.ROTATION;
        }
    }

    showHideTranslationControl(show: boolean) {
        const viewModel = this._transformEditor.viewModel;

        if (show) {
            viewModel.activateTranslationAndRotationMode();
        } else {
            // activate only rotation
            viewModel.deactivate();
            viewModel.activate();
            viewModel.editorMode = EditorMode.ROTATION;
            this._transformEditor.hideMenu();
        }
    }

    _hideRotationControl() {
        const transformEditorViewModel = this._transformEditor.viewModel;

        transformEditorViewModel.deactivate();
    }

    // we can access three position for auto orientation

    _onPreparedThreePointsForAutoRotation() {
        const pointCollection = this._autoOrientationMouseHandler.pointCollection;

        const position0 = pointCollection.get(0).position;
        const position1 = pointCollection.get(1).position;
        const position2 = pointCollection.get(2).position;

        this._doAutoOrientation(position0, position1, position2);
        this._showRotationControl();
    }

    _doAutoOrientation(position0: Cartesian3, position1: Cartesian3, position2: Cartesian3) {
        // https://stackoverflow.com/questions/67315980/align-geometry-to-plane-selecting-3-intersected-points

        // we can access three position for auto orientation

        const reverseUpDirection = this._ui.jqReverseUpDirectionCheckbox.is(":checked");

        const subVec1 = Cartesian3.subtract(position2, position0, new Cartesian3());
        const subVec2 = Cartesian3.subtract(position1, position0, new Cartesian3());

        let crossVector = Cartesian3.cross(subVec1, subVec2, new Cartesian3());

        if (reverseUpDirection) {
            crossVector = Cartesian3.negate(crossVector, new Cartesian3());
        }

        // get vertical direction in asset

        const asset = this._assetViewer.masterAsset;

        asset.rotate(crossVector);

        const geolocation = asset.calculateGeolocation();
        const hpr = new HeadingPitchRoll(
            CesiumMath.toRadians(geolocation.heading),
            CesiumMath.toRadians(geolocation.pitch),
            CesiumMath.toRadians(geolocation.roll)
        );

        this._ignoreOnHeadingPitchRollChanged = true;
        this._transformEditor.viewModel.headingPitchRoll = hpr;
        this._ignoreOnHeadingPitchRollChanged = false;

        if (!this._debug) {
            this._autoOrientationMouseHandler.clear();
        } else {
            this._autoOrientationMouseHandler.updatePositions();

            const viewer = this._assetViewer.cesiumViewer as Viewer;

            const length = asset.tileset.boundingSphere.radius;

            const extendedCross = Cartesian3.normalize(crossVector, new Cartesian3());

            Cartesian3.multiplyByScalar(extendedCross, length, extendedCross);

            const normalEndPosition = Cartesian3.add(position0, extendedCross, new Cartesian3());

            this._normalArrow = viewer.entities.add({
                polyline: {
                    positions: [position0, normalEndPosition],
                    width: 10,
                    arcType: ArcType.NONE,
                    material: new PolylineArrowMaterialProperty(Color.PURPLE)
                }
            });

            const localToReference = asset.getRefereceFrame(new Matrix4());

            const unitZInWorld = Matrix4.multiplyByPointAsVector(localToReference, Cartesian3.UNIT_Z, new Cartesian3());
            Cartesian3.normalize(unitZInWorld, unitZInWorld);

            Cartesian3.multiplyByScalar(unitZInWorld, length, unitZInWorld);

            const rotatedNormalEndPosition = Cartesian3.add(position0, unitZInWorld, new Cartesian3());

            this._rotatedNormalArrow = viewer.entities.add({
                polyline: {
                    positions: [position0, rotatedNormalEndPosition],
                    width: 15,
                    arcType: ArcType.NONE,
                    material: new PolylineArrowMaterialProperty(Color.YELLOW)
                }
            });
        }
    }

    _onPositionChanged(position: Cartesian3 /* , oldPosition: Cartesian3 */) {
        if (this._ignoreOnPositionChanged) {
            return;
        }

        const asset = this._assetViewer.masterAsset;

        asset.moveTightBoundingSphere(position);
        const carto = Cartographic.fromCartesian(position, Ellipsoid.WGS84, _onPositionChangedCartoScratch);

        const longitude = CesiumMath.toDegrees(carto.longitude);
        const latitude = CesiumMath.toDegrees(carto.latitude);
        const height = asset.hasValidGeoRef() ? asset.heightOfGeoRef() : carto.height;

        this._ui.displayBLH(longitude, latitude, height);
    }

    _onHeadingPitchRollChanged(/* hpr: HeadingPitchRoll, oldHpr: HeadingPitchRoll */) {
        if (this._ignoreOnHeadingPitchRollChanged) {
            return;
        }

        const asset = this._assetViewer.masterAsset;

        asset.hpr = this._transformEditor.viewModel.headingPitchRoll;
    }

    _onScaleChanged() {
        if (this._ignoreOnScaleChanged) {
            return;
        }

        const asset = this._assetViewer.masterAsset;

        asset.scale = this._transformEditor.viewModel.scale;
    }

    _onPreparedTwoPointsForAutoScale() {
        setTimeout(() => {
            const pointCollection = this._autoScaleMouseHandler.pointCollection;

            const position0 = pointCollection.get(0).position;
            const position1 = pointCollection.get(1).position;

            const distance = Cartesian3.distance(position0, position1);

            this._ui.jqMeasuredDistanceInput.val(distance.toFixed(5));

            // this._autoScaleMouseHandler.clear();
        }, 100);
    }

    _onDoScaleMeasurement() {
        let measuredDistance = parseFloat(this._ui.jqMeasuredDistanceInput.val());

        const pointCollection = this._autoScaleMouseHandler.pointCollection;

        if (pointCollection.length > 1) {
            const position0 = pointCollection.get(0).position;
            const position1 = pointCollection.get(1).position;

            measuredDistance = Cartesian3.distance(position0, position1);
        }

        const input = this._ui.jqKnownDistanceInput.val() as string;

        if (!input) {
            this._autoScaleMouseHandler.clear();
            return;
        }

        const knownDistance = parseFloat(input);

        if (Number.isNaN(knownDistance)) {
            this._autoScaleMouseHandler.clear();
            return;
        }

        let scale = knownDistance / measuredDistance;

        /**
         * When changing the scale using the wizard for a second time,
         * the new scale factor should be multiplied by the old scale factor, not used as an absolute value.
         */

        scale *= this._transformEditor.viewModel.scale.x;

        this._transformEditor.viewModel.scale = new Cartesian3(scale, scale, scale);

        this._ui.jqCalculatedScaleInput.val(scale.toFixed(5));
        this._ui.jqScaleWizardApplyButton.attr("disabled", "disabled");
        this._ui.jqScaleWizardApplyButton.addClass("hidden");
        this._ui.jqMeasuredDistanceInput.val(measuredDistance.toFixed(5));

        this._autoScaleMouseHandler.clear();
    }

    _onKeyDown(event: { keyCode: number }) {
        const keyCode = event.keyCode;

        // esc key
        if (keyCode === 27) {
            if (this._autoOrientationMouseHandler.activated) {
                this._autoOrientationMouseHandler.deactivate();
                this._autoOrientationMouseHandler.clear();
            }

            if (this._autoScaleMouseHandler.activated) {
                this._autoScaleMouseHandler.deactivate();
                this._autoScaleMouseHandler.clear();
            }
        }
    }

    _addDebugAxes() {
        const tileset = this._assetViewer.tileset();

        const scene = this._assetViewer.cesiumViewer!.scene;
        const boundingSphere = tileset.boundingSphere;

        this._frame = scene.primitives.add(
            new DebugModelMatrixPrimitive({
                modelMatrix: Transforms.eastNorthUpToFixedFrame(
                    Cartesian3.fromDegrees(0, 0, 0),
                    undefined,
                    new Matrix4()
                ),
                length: boundingSphere.radius * 2,
                width: 5.0
            })
        );
    }

    _onPositionChangedAtAsset(/* position: Cartesian3 */) {
        if (!this.active) {
            return;
        }

        this._ignoreOnPositionChanged = true;

        const asset = this._assetViewer.masterAsset;

        if (asset.hasValidGeoRef()) {
            this._transformEditor.viewModel.position = asset.geoRef;
        } else {
            this._transformEditor.viewModel.position = asset.tightBoundingSphere.center;
        }

        this._ignoreOnPositionChanged = false;
    }
}
