import { Cartesian3, Cartographic, Label, Math as CesiumMath, PointPrimitive, SceneMode } from "cesium";
import { MeasurementType } from "./MeasurementType";
import { Measurement } from "./Measurement";
import {
    getAngleFractionDigits,
    getSlope,
    getWorldPosition,
    MeasureUnits,
    MouseEvent,
    PrimitiveSettings,
    SRSType
} from "../../../core";
import { MeasurementTool } from "./MeasurementTool";
import { editingPointOptions } from "../EditCommon";
import { PointMeasurementTool } from "./PointMeasurementTool";

const scratchCartesian = new Cartesian3();
const scratchCartographic = new Cartographic();

const fractionDigits = 3;

export class PointMeasurement extends Measurement {
    private _height: number;
    private _slope: number;
    private readonly _point: PointPrimitive;
    private readonly _label: Label;
    private readonly _parentTool: MeasurementTool;
    private _originalPosition: Cartesian3;

    constructor(options: {
        id: string;
        height: number;
        slope: number;
        label: Label;
        point: PointPrimitive;
        measurementTool: MeasurementTool;
    }) {
        super({
            id: options.id,
            type: MeasurementType.Point
        });

        this._height = options.height;
        this._slope = options.slope;
        this._label = options.label;
        this._point = options.point;
        this._parentTool = options.measurementTool;
        this._originalPosition = new Cartesian3();
    }

    get point() {
        return this._point;
    }

    get label() {
        return this._label;
    }

    showHide(show: boolean): void {
        this._label.show = show;
        this._point.show = show;
    }

    getDetail(): Object {
        return {
            position: this.point.position,
            height: this._height,
            slope: this._slope
        };
    }

    isContain(primitive: any): boolean {
        if (Object.is(primitive, this._label)) {
            return true;
        }

        if (Object.is(primitive, this._point)) {
            return true;
        }

        return false;
    }

    measurementString() {
        const positionCartographic = Cartographic.fromCartesian(this._label.position);

        const angleUnit = this._parentTool.selectedUnits.angleUnits;
        const angleFractionDigits = getAngleFractionDigits(angleUnit);

        const srsType = (this._parentTool as PointMeasurementTool).crsInfo.srs_type;

        let text;
        if (srsType === SRSType.Geographic2d) {
            text =
                `Long: ${MeasureUnits.longitudeToString(
                    positionCartographic.longitude,
                    this._parentTool.selectedUnits.angleUnits,
                    undefined,
                    angleFractionDigits
                )}\n` +
                `Lat: ${MeasureUnits.latitudeToString(
                    positionCartographic.latitude,
                    this._parentTool.selectedUnits.angleUnits,
                    undefined,
                    angleFractionDigits
                )} \n` +
                `Elevation: ${MeasureUnits.distanceToString(
                    this._height,
                    this._parentTool.selectedUnits.distanceUnits,
                    undefined,
                    3,
                    3
                )} \n` +
                `Slope: ${MeasureUnits.angleToString(
                    this._slope,
                    this._parentTool.selectedUnits.angleUnits,
                    undefined,
                    3
                )}`;
        } else {
            const coord = (this._parentTool as PointMeasurementTool).getCoordinate(positionCartographic);

            text =
                `E: ${coord[0].toFixed(fractionDigits)}\n` +
                `N: ${coord[1].toFixed(fractionDigits)} \n` +
                `Elevation: ${MeasureUnits.distanceToString(
                    this._height,
                    this._parentTool.selectedUnits.distanceUnits,
                    undefined,
                    3,
                    3
                )} \n` +
                `Slope: ${MeasureUnits.angleToString(
                    this._slope,
                    this._parentTool.selectedUnits.angleUnits,
                    undefined,
                    3
                )}`;
        }

        return text;
    }

    update(event: MouseEvent) {
        const scene = this._parentTool.scene;
        this._label.show = false;
        this._point.show = false;

        if (scene.mode === SceneMode.MORPHING) {
            return;
        }

        this._point.show = false;

        const movePosition = event.pos;
        const position = getWorldPosition(scene, movePosition, scratchCartesian);

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

        const measureUnit = this._parentTool.selectedUnits;
        const angleUnit = this._parentTool.selectedUnits.angleUnits;
        const angleFractionDigits = getAngleFractionDigits(angleUnit);
        const local = this._parentTool.selectedLocale;

        const label = this._label;
        label.position = position;
        label.show = true;

        const srsType = (this._parentTool as PointMeasurementTool).crsInfo.srs_type;

        if (srsType === SRSType.Geographic2d) {
            label.text =
                `lon: ${MeasureUnits.longitudeToString(
                    positionCartographic.longitude,
                    angleUnit,
                    local,
                    angleFractionDigits
                )}\n` +
                `lat: ${MeasureUnits.latitudeToString(
                    positionCartographic.latitude,
                    angleUnit,
                    local,
                    angleFractionDigits
                )}`;
        } else {
            const coord = (this._parentTool as PointMeasurementTool).getCoordinate(positionCartographic);

            label.text = `E: ${coord[0].toFixed(fractionDigits)}\nN: ${coord[1].toFixed(fractionDigits)}`;
        }

        if (scene.mode !== SceneMode.SCENE2D && scene.pickPositionSupported) {
            label.text += `\nelevation: ${MeasureUnits.distanceToString(
                height,
                measureUnit.distanceUnits,
                local,
                3,
                3
            )}`;
            if (slope) {
                label.text += `\nslope: ${MeasureUnits.angleToString(slope, measureUnit.slopeUnits, local, 3)}`;
            }
        }

        this._height = height;
        this._slope = slope;
    }

    startEditing() {
        const point = this._point;

        point.color = editingPointOptions.color;
        point.pixelSize = editingPointOptions.pixelSize;
        point.outlineWidth = editingPointOptions.outlineWidth;
        point.outlineColor = editingPointOptions.outlineColor;

        Cartesian3.clone(this._point.position, this._originalPosition);
    }

    finishEditing(cancel: boolean) {
        const pointOptions = PrimitiveSettings.getPointOptions();

        const point = this._point;

        point.color = pointOptions.color;
        point.pixelSize = pointOptions.pixelSize;

        point.outlineWidth = 0;

        if (!cancel) {
            Cartesian3.clone(this._point.position, this._originalPosition);
            return;
        }

        this._point.position = this._originalPosition;
        this._label.position = this._originalPosition;
    }
}
