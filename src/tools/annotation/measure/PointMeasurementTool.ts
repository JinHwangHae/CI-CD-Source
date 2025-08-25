/* qeslint-disable */
// q@ts-nocheck

import {
    Cartesian2,
    Cartesian3,
    Cartographic,
    createGuid,
    destroyObject,
    HorizontalOrigin,
    Label,
    Math as CesiumMath,
    SceneMode,
    ScreenSpaceEventType,
    ScreenSpaceEventHandler,
    VerticalOrigin
} from "cesium";

import {
    CRSInfo,
    CRSManager,
    getSlope,
    getWorldPositionOn3DTiles,
    getAngleFractionDigits,
    MeasureUnits,
    MouseButton,
    MouseEvent,
    PrimitiveSettings,
    SRSType
} from "../../../core";
import { newCartesian3FromObject } from "../util";

import {
    MeasurementTool,
    MeasurementToolConstructorOptions,
    PointMeasurementData,
    PositionData
} from "./MeasurementTool";
import { PointMeasurement } from "./PointMeasurement";

const scratchCartesian = new Cartesian3();
const scratchCartographic = new Cartographic();

interface PointMeasurementToolConstructorOptions extends MeasurementToolConstructorOptions {
    crsInfo: CRSInfo;
    crsManager: CRSManager;
}

const fractionDigits = 3;

export class PointMeasurementTool extends MeasurementTool {
    private _position: Cartesian3;
    private _height: number;
    private _slope: number;
    private _label: Label;
    private _screenSpaceEventHandler: ScreenSpaceEventHandler;
    private _crsInfo: CRSInfo;
    private _crsManager: CRSManager;

    constructor(options: PointMeasurementToolConstructorOptions) {
        super(options);

        this._label = this._labelCollection.add(
            PrimitiveSettings.getLabelOptions({
                horizontalOrigin: HorizontalOrigin.LEFT,
                verticalOrigin: VerticalOrigin.CENTER,
                pixelOffset: new Cartesian2(10, 0)
            })
        );

        this._position = new Cartesian3();
        this._height = 0.0;
        this._slope = 0.0;

        // for choosing correctly the tilt center
        this._screenSpaceEventHandler = new ScreenSpaceEventHandler(this._viewer.canvas);

        this._screenSpaceEventHandler.setInputAction(() => {
            this._point.show = false;
            this._label.show = false;
        }, ScreenSpaceEventType.RIGHT_DOWN);

        this._screenSpaceEventHandler.setInputAction(() => {
            this._point.show = true;
            this._label.show = true;
        }, ScreenSpaceEventType.RIGHT_UP);

        this._crsInfo = options.crsInfo;
        this._crsManager = options.crsManager;
    }

    get position() {
        return this._position;
    }

    get height() {
        return this._height;
    }

    get slope() {
        return this._slope;
    }

    _pickPositionSupported() {
        return this._scene.pickPositionSupported;
    }

    _saveCurrentMeasurementAndPrepareNew(id: string) {
        this._measurements.push(
            new PointMeasurement({
                id: id,
                height: this._height,
                slope: this._slope,
                point: this._point,
                label: this._label,
                measurementTool: this
            })
        );

        this._point = this._pointCollection.add(PrimitiveSettings.getPointOptions());
        this._label = this._labelCollection.add(
            PrimitiveSettings.getLabelOptions({
                horizontalOrigin: HorizontalOrigin.LEFT,
                verticalOrigin: VerticalOrigin.CENTER,
                pixelOffset: new Cartesian2(10, 0)
            })
        );
    }

    canvasPressEvent(event: MouseEvent): void {
        const scene = this._scene;

        if (scene.mode === SceneMode.MORPHING) {
            return;
        }

        if (event.button !== MouseButton.LeftButton) {
            return;
        }

        const clickPosition = event.pos;
        const position = getWorldPositionOn3DTiles(scene, clickPosition, scratchCartesian);

        if (!position) {
            return;
        }

        this._drawingStarted.raiseEvent();

        this._label.show = false;
        this._point.show = false;

        this._point.position = position;

        // @ts-ignore
        const positionCartographic = scene.frameState.mapProjection.ellipsoid.cartesianToCartographic(
            position,
            scratchCartographic
        );

        let height = positionCartographic.height;

        if (CesiumMath.equalsEpsilon(height, 0.0, CesiumMath.EPSILON3)) {
            height = 0.0;
        }

        let slope = 0;

        if (scene.mode !== SceneMode.SCENE2D) {
            slope = getSlope(scene, clickPosition);
        }

        this._point.show = true;

        const angleUnit = this._selectedUnits.angleUnits;
        const angleFractionDigits = getAngleFractionDigits(angleUnit);

        const label = this._label;
        label.position = position;
        label.show = true;
        label.text =
            `lon: ${MeasureUnits.longitudeToString(
                positionCartographic.longitude,
                this._selectedUnits.angleUnits,
                this._selectedLocale,
                angleFractionDigits
            )}\n` +
            `lat: ${MeasureUnits.latitudeToString(
                positionCartographic.latitude,
                this._selectedUnits.angleUnits,
                this._selectedLocale,
                angleFractionDigits
            )}`;

        if (scene.mode !== SceneMode.SCENE2D && this._pickPositionSupported()) {
            label.text += `\nelevation: ${MeasureUnits.distanceToString(
                height,
                this._selectedUnits.distanceUnits,
                this._selectedLocale,
                3,
                3
            )}`;
            if (slope) {
                label.text += `\nslope: ${MeasureUnits.angleToString(
                    slope,
                    this._selectedUnits.slopeUnits,
                    this._selectedLocale,
                    3
                )}`;
            }
        }

        this._position = Cartesian3.clone(position, this._position);
        this._height = height;
        this._slope = slope;

        this._saveCurrentMeasurementAndPrepareNew(createGuid());

        // @ts-ignore
        this._drawingFinished.raiseEvent(this._measurements.length - 1);
    }

    canvasMoveEvent(event: MouseEvent): void {
        if (this._point === null) return;

        const button = event.button;

        if (
            button === MouseButton.LeftButton ||
            button === MouseButton.MidButton ||
            button === MouseButton.RightButton
        ) {
            return;
        }

        const scene = this._scene;

        this._label.show = false;
        this._point.show = false;

        if (scene.mode === SceneMode.MORPHING) {
            return;
        }

        this._point.show = false;

        const movePosition = event.pos;
        const position = getWorldPositionOn3DTiles(scene, movePosition, scratchCartesian);

        if (!position) {
            return;
        }

        this._point.position = position;
        // @ts-ignore
        const positionCartographic = scene.frameState.mapProjection.ellipsoid.cartesianToCartographic(
            position,
            scratchCartographic
        );

        let height = positionCartographic.height;

        if (CesiumMath.equalsEpsilon(height, 0.0, CesiumMath.EPSILON3)) {
            height = 0.0;
        }

        let slope = 0;
        if (scene.mode !== SceneMode.SCENE2D) {
            slope = getSlope(scene, movePosition);
        }

        this._point.show = true;

        const angleUnit = this._selectedUnits.angleUnits;
        const angleFractionDigits = getAngleFractionDigits(angleUnit);

        const label = this._label;
        label.position = position;
        label.show = true;

        const srsType = this._crsInfo.srs_type;

        if (srsType === SRSType.Geographic2d) {
            label.text =
                `lon: ${MeasureUnits.longitudeToString(
                    positionCartographic.longitude,
                    angleUnit,
                    this._selectedLocale,
                    angleFractionDigits
                )}\n` +
                `lat: ${MeasureUnits.latitudeToString(
                    positionCartographic.latitude,
                    angleUnit,
                    this._selectedLocale,
                    angleFractionDigits
                )}`;
        } else {
            const coord = this.getCoordinate(positionCartographic);

            label.text = `E: ${coord[0].toFixed(fractionDigits)}\nN: ${coord[1].toFixed(fractionDigits)}`;
        }

        if (scene.mode !== SceneMode.SCENE2D && this._pickPositionSupported()) {
            label.text += `\nelevation: ${MeasureUnits.distanceToString(
                height,
                this._selectedUnits.distanceUnits,
                this._selectedLocale,
                3,
                3
            )}`;
            if (slope) {
                label.text += `\nslope: ${MeasureUnits.angleToString(
                    slope,
                    this._selectedUnits.slopeUnits,
                    this._selectedLocale,
                    3
                )}`;
            }
        }

        this._position = Cartesian3.clone(position, this._position);
        this._height = height;
        this._slope = slope;
    }

    /**
     * Resets the widget.
     */
    reset() {
        this._position = Cartesian3.clone(Cartesian3.ZERO, this._position);
    }

    /**
     * @returns {Boolean} true if the object has been destroyed, false otherwise.
     */
    // eslint-disable-next-line class-methods-use-this
    isDestroyed() {
        return false;
    }

    /**
     * Destroys the measurement.
     */
    destroy() {
        for (let i = 0; i < this._measurements.length; i++) {
            const measurementResult = this._measurements[i] as PointMeasurement;

            this._pointCollection.remove(measurementResult.point);
            this._labelCollection.remove(measurementResult.label);
        }

        return destroyObject(this);
    }

    loadData(data: PointMeasurementData, id: string) {
        const scene = this._scene;
        let position;
        let height;
        let slope;

        if (!data.position) {
            // this is old stlye data
            const positionData = data as unknown as PositionData;

            position = newCartesian3FromObject(positionData);
            // @ts-ignore
            const positionCartographic = scene.frameState.mapProjection.ellipsoid.cartesianToCartographic(
                position,
                scratchCartographic
            );

            height = positionCartographic.height;

            if (CesiumMath.equalsEpsilon(height, 0.0, CesiumMath.EPSILON3)) {
                height = 0.0;
            }

            slope = 0;
        } else {
            position = newCartesian3FromObject(data.position);
            height = data.height;
            slope = data.slope;
        }

        this._label.show = true;
        this._point.show = true;

        this._point.position = position;
        this._label.position = position;

        // @ts-ignore
        const positionCartographic = scene.frameState.mapProjection.ellipsoid.cartesianToCartographic(
            position,
            scratchCartographic
        );

        const label = this._label;

        const angleUnit = this._selectedUnits.angleUnits;
        const angleFractionDigits = getAngleFractionDigits(angleUnit);

        const srsType = this._crsInfo.srs_type;

        if (srsType === SRSType.Geographic2d) {
            label.text =
                `lon: ${MeasureUnits.longitudeToString(
                    positionCartographic.longitude,
                    angleUnit,
                    this._selectedLocale,
                    angleFractionDigits
                )}\n` +
                `lat: ${MeasureUnits.latitudeToString(
                    positionCartographic.latitude,
                    angleUnit,
                    this._selectedLocale,
                    angleFractionDigits
                )}`;
        } else {
            const coord = this.getCoordinate(positionCartographic);

            label.text = `E: ${coord[0].toFixed(fractionDigits)}\nN: ${coord[1].toFixed(fractionDigits)}`;
        }

        label.text += `\nelevation: ${MeasureUnits.distanceToString(
            height,
            this._selectedUnits.distanceUnits,
            this._selectedLocale
        )}`;

        label.text += `\nslope: ${MeasureUnits.angleToString(
            slope,
            this._selectedUnits.slopeUnits,
            this._selectedLocale,
            3
        )}`;

        this._position = Cartesian3.clone(position, this._position);
        this._height = height;
        this._slope = slope;

        this._saveCurrentMeasurementAndPrepareNew(id);
    }

    removeMeasurementById(id: string) {
        const measurementResult = this._measurements;

        const index = measurementResult.findIndex((measurement) => measurement.id === id);

        if (index === -1) {
            return false;
        }

        const foundMeasurement = measurementResult[index] as PointMeasurement;

        this._pointCollection.remove(foundMeasurement.point);
        this._labelCollection.remove(foundMeasurement.label);

        measurementResult.splice(index, 1);
        return true;
    }

    get crsInfo() {
        return this._crsInfo;
    }

    set crsInfo(val) {
        this._crsInfo = val;
    }

    getCoordinate(carto: Cartographic) {
        return this._crsManager.getCoordinate(carto, this._crsInfo);
    }
}
