/* qeslint-disable */
// q@ts-nocheck

import {
    Cartesian2,
    Cartesian3,
    createGuid,
    destroyObject,
    Event,
    HorizontalOrigin,
    Material,
    VerticalOrigin
} from "cesium";

import { getWorldPosition, MeasureUnits, MouseEvent, PolylinePrimitive, PrimitiveSettings } from "../../../core";

import { MeasurementTool, DistanceMeasurementData, MeasurementToolConstructorOptions } from "./MeasurementTool";
import { DistanceMeasurement } from "./DistanceMeasurement";

import { newCartesian3FromObject } from "../util";

const Mode = {
    BeforeDraw: 0,
    Drawing: 1,
    AfterDraw: 2
};

const cart3Scratch1 = new Cartesian3();
const scratchPickedPosition = new Cartesian3();

/**
 * Draws a measurement between two points.
 */
export class DistanceMeasurementTool extends MeasurementTool {
    private _positions: Cartesian3[];
    private _mode: number;
    private _distanceMeasurement: DistanceMeasurement;

    private readonly _removeEvent: Event.RemoveCallback;

    constructor(options: MeasurementToolConstructorOptions) {
        super(options);

        const positions = [new Cartesian3(), new Cartesian3()];
        this._positions = positions;

        this._mode = Mode.BeforeDraw;
        this._distanceMeasurement = this._createMeasurement();

        this._removeEvent = this.scene.preRender.addEventListener(() => {
            if (this._mode === Mode.BeforeDraw) {
                return;
            }

            this._distanceMeasurement.updateLabelPosition(this.scene);
        });
    }

    deactivate(): void {
        super.deactivate();

        this.reset();
        this._point.show = false;
    }

    private _createMeasurement() {
        const labelCollection = this._labelCollection;
        const primitives = this._primitives;

        const pointCollection = this._pointCollection;

        const startPoint = pointCollection.add(PrimitiveSettings.getPointOptions());
        const endPoint = pointCollection.add(PrimitiveSettings.getPointOptions());

        const polyline = primitives.add(
            new PolylinePrimitive(
                PrimitiveSettings.getPolylineOptions({
                    width: 3,
                    show: false,
                    positions: [new Cartesian3(), new Cartesian3()]
                })
            )
        );

        const xyPolyline = primitives.add(
            new PolylinePrimitive(
                PrimitiveSettings.getPolylineOptions({
                    width: 2,
                    positions: [new Cartesian3(), new Cartesian3(), new Cartesian3()],
                    materialType: Material.PolylineDashType
                })
            )
        );

        const xyBox = primitives.add(
            new PolylinePrimitive(
                PrimitiveSettings.getPolylineOptions({
                    width: 1,
                    positions: [new Cartesian3(), new Cartesian3(), new Cartesian3()]
                })
            )
        );

        const label = labelCollection.add(
            PrimitiveSettings.getLabelOptions({
                horizontalOrigin: HorizontalOrigin.LEFT,
                verticalOrigin: VerticalOrigin.TOP,
                pixelOffset: new Cartesian2(10, 10)
            })
        );

        const xLabel = labelCollection.add(
            PrimitiveSettings.getLabelOptions({
                scale: 0.6
            })
        );

        const yPixelOffset = new Cartesian2(-9, 0);
        const xPixelOffset = new Cartesian2(9, 0);

        const xAngleLabel = labelCollection.add(
            PrimitiveSettings.getLabelOptions({
                scale: 0.6,
                horizontalOrigin: HorizontalOrigin.LEFT,
                verticalOrigin: VerticalOrigin.CENTER,
                pixelOffset: xPixelOffset
            })
        );

        const yLabel = labelCollection.add(
            PrimitiveSettings.getLabelOptions({
                scale: 0.6,
                horizontalOrigin: HorizontalOrigin.RIGHT,
                pixelOffset: yPixelOffset
            })
        );

        const yAngleLabel = labelCollection.add(
            PrimitiveSettings.getLabelOptions({
                scale: 0.6,
                verticalOrigin: VerticalOrigin.TOP,
                pixelOffset: new Cartesian2(0, 9)
            })
        );

        return new DistanceMeasurement({
            id: createGuid(),
            measureUnits: this._selectedUnits,
            startPoint: startPoint,
            endPoint: endPoint,
            polyline: polyline,
            xyPolyline: xyPolyline,
            xyBox: xyBox,
            label: label,
            xLabel: xLabel,
            xAngleLabel: xAngleLabel,
            yLabel: yLabel,
            yAngleLabel: yAngleLabel
        });
    }

    canvasPressEvent(event: MouseEvent): void {
        const scene = this._scene;

        if (this._mode === Mode.AfterDraw) {
            this.reset();
            this._point.show = false;
        }

        const pos = getWorldPosition(scene, event.pos, scratchPickedPosition);

        if (!pos) {
            return;
        }

        const mode = this._mode;

        const distanceMeasurement = this._distanceMeasurement;

        const positions = this._positions;

        if (mode === Mode.BeforeDraw) {
            distanceMeasurement.polyline.show = true;

            distanceMeasurement.startPoint.position = pos;
            distanceMeasurement.startPoint.show = true;

            pos.clone(positions[0]);
            pos.clone(positions[1]);

            distanceMeasurement.polyline.positions = positions;

            this._mode = Mode.Drawing;

            this._drawingStarted.raiseEvent();
        } else if (mode === Mode.Drawing) {
            distanceMeasurement.endPoint.position = positions[1];
            distanceMeasurement.endPoint.show = true;

            this.finishDrawing();
        }
    }

    canvasMoveEvent(event: MouseEvent): void {
        super.canvasMoveEvent(event);

        if (this._mode !== Mode.Drawing) {
            this._point.show = false;
            return;
        }

        const pos = getWorldPosition(this._scene, event.pos, cart3Scratch1);

        if (!pos) {
            return;
        }

        const positions = this._positions;
        Cartesian3.clone(pos, positions[1]);

        const distanceMeasurement = this._distanceMeasurement;

        distanceMeasurement.polyline.positions = positions;
        distanceMeasurement.updateComponents();
    }

    reset() {
        this._mode = Mode.BeforeDraw;

        this._distanceMeasurement.reset();
    }

    /**
     * @returns {Boolean} true if the object has been destroyed, false otherwise.
     */
    // eslint-disable-next-line class-methods-use-this
    isDestroyed() {
        return false;
    }

    destroy() {
        this._removeEvent();

        const primitives = this._primitives;
        const distanceMeasurement = this._distanceMeasurement;

        primitives.remove(distanceMeasurement.polyline);
        primitives.remove(distanceMeasurement.xyPolyline);
        primitives.remove(distanceMeasurement.xyBox);

        const points = this._pointCollection;
        points.remove(distanceMeasurement.startPoint);
        points.remove(distanceMeasurement.endPoint);

        const labels = this._labelCollection;
        labels.remove(distanceMeasurement.label);
        labels.remove(distanceMeasurement.xLabel);
        labels.remove(distanceMeasurement.yLabel);
        labels.remove(distanceMeasurement.xAngleLabel);
        labels.remove(distanceMeasurement.yAngleLabel);

        return destroyObject(this);
    }

    loadData(data: DistanceMeasurementData, id: string) {
        const startPointPosition = newCartesian3FromObject(data.startPointPosition);
        const endPointPosition = newCartesian3FromObject(data.endPointPosition);

        const ditanceMeasurement = this._distanceMeasurement;

        ditanceMeasurement.startPoint.show = true;
        ditanceMeasurement.startPoint.position = startPointPosition;

        ditanceMeasurement.endPoint.show = true;
        ditanceMeasurement.endPoint.position = endPointPosition;

        ditanceMeasurement.polyline.show = true;
        ditanceMeasurement.xLabel.show = true;
        ditanceMeasurement.xAngleLabel.show = true;
        ditanceMeasurement.polyline.positions = [startPointPosition, endPointPosition];

        const vec = Cartesian3.subtract(startPointPosition, endPointPosition, cart3Scratch1);
        const distance = Cartesian3.magnitude(vec);

        const label = ditanceMeasurement.label;
        label.position = Cartesian3.midpoint(startPointPosition, endPointPosition, cart3Scratch1);
        label.text = MeasureUnits.distanceToString(
            distance,
            this._selectedUnits.distanceUnits,
            this._selectedLocale,
            3
        );
        label.show = true;

        ditanceMeasurement.updateComponents();

        ditanceMeasurement.id = id;
        this._measurements.push(ditanceMeasurement);

        this._distanceMeasurement = this._createMeasurement();
    }

    removeMeasurementById(id: string) {
        const measurementResult = this._measurements;

        const index = measurementResult.findIndex((measurement) => measurement.id === id);

        if (index === -1) {
            return false;
        }

        const foundMeasurement = measurementResult[index] as DistanceMeasurement;

        const primitives = this._primitives;

        primitives.remove(foundMeasurement.polyline);
        primitives.remove(foundMeasurement.xyPolyline);
        primitives.remove(foundMeasurement.xyBox);

        const points = this._pointCollection;

        points.remove(foundMeasurement.startPoint);
        points.remove(foundMeasurement.endPoint);

        const labels = this._labelCollection;

        labels.remove(foundMeasurement.label);
        labels.remove(foundMeasurement.xLabel);
        labels.remove(foundMeasurement.yLabel);
        labels.remove(foundMeasurement.xAngleLabel);
        labels.remove(foundMeasurement.yAngleLabel);

        measurementResult.splice(index, 1);

        return true;
    }

    finishDrawing() {
        this._mode = Mode.AfterDraw;

        const distanceMeasurement = this._distanceMeasurement;

        this._measurements.push(distanceMeasurement);

        this._distanceMeasurement = this._createMeasurement();

        // @ts-ignore
        this._drawingFinished.raiseEvent(this._measurements.length - 1);

        this._point.show = false;
    }
}
