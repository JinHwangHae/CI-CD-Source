/* qeslint-disable */
// q@ts-nocheck
import {
    BillboardCollection,
    Cartesian2,
    Cartesian3,
    createGuid,
    defined,
    destroyObject,
    Event,
    HorizontalOrigin,
    Label,
    SceneTransforms,
    VerticalOrigin
} from "cesium";

import { MeasurementTool, MeasurementToolConstructorOptions, PositionData } from "./MeasurementTool";

import { PolylineMeasurement } from "./PolylineMeasurement";

import { newCartesian3ArrayFromArray } from "../util";
import { DrawingMode, MeasureUnits, MouseEvent, MouseButton, PolylineDrawing, PrimitiveSettings } from "../../../core";
import { calculateMostTopPosition } from "./common";
import { EditablePolyline } from "../EditablePolyline";

const cart2Scratch1 = new Cartesian2();
const cart2Scratch2 = new Cartesian2();
const cart2Scratch3 = new Cartesian2();

const scratch = new Cartesian3();

/**
 * Creates an multi-line distance measurement.
 */
export class PolylineMeasurementTool extends MeasurementTool {
    private readonly _drawing: PolylineDrawing;

    private readonly _billboardCollection: BillboardCollection;
    private _label: Label;
    private _distance: number;

    private _segmentLabels: Label[];
    private _previousDistance: number;
    private _removeEvent: Event.RemoveCallback;

    constructor(options: MeasurementToolConstructorOptions) {
        super(options);

        this._billboardCollection = new BillboardCollection();
        this.scene.primitives.add(this._billboardCollection);

        const drawingOptions = {
            scene: this.scene,
            primitives: options.primitives,
            pointOptions: PrimitiveSettings.getPointOptions(),
            polylineOptions: PrimitiveSettings.getPolylineOptions({ allowPicking: false })
        };

        this._drawing = new PolylineDrawing(drawingOptions);

        const scene = this._scene;
        this._label = this._labelCollection.add(PrimitiveSettings.getLabelOptions());
        this._segmentLabels = [];

        this._previousDistance = 0;
        this._distance = 0;

        this._removeEvent = scene.preRender.addEventListener(() => {
            this._updateLabels();
        });
    }

    activate(): void {
        super.activate();

        this._drawing.reset();
    }

    deactivate(): void {
        super.deactivate();

        this._drawing.reset();
        this._label.show = false;

        this._segmentLabels.forEach((label) => {
            this._labelCollection.remove(label);
        });

        this._segmentLabels.length = 0;
        this._previousDistance = 0;
        this._distance = 0;
    }

    get distance() {
        return this._distance;
    }

    private _updateLabels() {
        const positions = this._drawing.positions;

        if (positions.length < 2) {
            return;
        }

        if (this._segmentLabels.length < 1) {
            return;
        }

        const scene = this._scene;
        let top = positions[0];
        const pos2d = SceneTransforms.wgs84ToWindowCoordinates(scene, top, cart2Scratch1);
        let lastScreenPos = defined(pos2d)
            ? Cartesian2.clone(pos2d, cart2Scratch3)
            : Cartesian2.fromElements(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, cart2Scratch3);
        let topY = lastScreenPos.y;
        const labels = this._segmentLabels;

        labels[0].show = this._drawing.polyline.positions.length > 2;

        for (let i = 1; i < positions.length; i++) {
            const nextScreenPos = SceneTransforms.wgs84ToWindowCoordinates(scene, positions[i], cart2Scratch2);
            if (!defined(nextScreenPos)) {
                continue;
            }

            const m = (lastScreenPos.y - nextScreenPos.y) / (nextScreenPos.x - lastScreenPos.x);
            const label = labels[i - 1];
            if (m > 0) {
                label.horizontalOrigin = HorizontalOrigin.LEFT;
            } else {
                label.horizontalOrigin = HorizontalOrigin.RIGHT;
            }

            if (nextScreenPos.y < topY) {
                topY = nextScreenPos.y;
                top = positions[i];
            }

            lastScreenPos = Cartesian2.clone(nextScreenPos, lastScreenPos);
        }

        if (this._drawing.mode === DrawingMode.AfterDraw) {
            this._label.position = top;
        }
    }

    private _addSementLabel(position1: Cartesian3, position2: Cartesian3) {
        const label = this._labelCollection.add(
            PrimitiveSettings.getLabelOptions({
                scale: 0.8,
                horizontalOrigin: HorizontalOrigin.LEFT,
                verticalOrigin: VerticalOrigin.TOP,
                pixelOffset: new Cartesian2(5, 5)
            })
        );

        label.position = Cartesian3.midpoint(position1, position2, new Cartesian3());
        label.text = MeasureUnits.distanceToString(
            Cartesian3.distance(position1, position2),
            this._selectedUnits?.distanceUnits,
            this._selectedLocale,
            3
        );

        label.show = true;
        this._segmentLabels.push(label);
    }

    private _addPoint(position: Cartesian3) {
        const positions = this._drawing.positions;

        if (positions.length > 0) {
            // store distance that was calculated on mouse move
            this._previousDistance = this._distance;

            this._addSementLabel(positions[positions.length - 1], position);
        }
        this._drawing.addPoint(position);
    }

    canvasDoubleClickEvent(): void {
        this.finishDrawing();
    }

    finishDrawing(): void {
        this._drawing.handleDoubleClick();

        this.saveCurrentMeasurementAndPrepareNew(createGuid());

        this.reset();

        // @ts-ignore
        this._drawingFinished.raiseEvent(this._measurements.length - 1);
        this._previousDistance = 0;
        this._distance = 0;
    }

    canvasPressEvent(event: MouseEvent): void {
        if (event.button !== MouseButton.LeftButton) {
            return;
        }

        const drawing = this._drawing;

        if (drawing.mode === DrawingMode.AfterDraw) {
            drawing.prepareNewPrimitives();
        }

        const position = drawing.handleClick(event.pos);

        if (position) {
            this._label.show = true;
            drawing.polyline.show = true;

            const positions = this._drawing.positions;

            if (positions.length > 1) {
                // store distance that was calculated on mouse move
                this._previousDistance = this._distance;

                this._addSementLabel(positions[positions.length - 2], positions[positions.length - 1]);
            }
        }

        if (position && this._drawing.positions.length === 1) {
            this._drawingStarted.raiseEvent();
        }
    }

    canvasMoveEvent(event: MouseEvent): void {
        if (event.button !== undefined) {
            return;
        }

        const drawing = this._drawing;

        const nextPos = drawing.handleMouseMove(event.pos);

        if (!nextPos) {
            return;
        }

        const positions = drawing.positions;

        const pos1 = positions[positions.length - 1];
        const pos2 = nextPos;
        const vec = Cartesian3.subtract(pos2, pos1, scratch);
        const distance = this._previousDistance + Cartesian3.magnitude(vec);

        const label = this._label;
        label.position = pos2;
        label.text = MeasureUnits.distanceToString(
            distance,
            this._selectedUnits.distanceUnits,
            this._selectedLocale,
            3
        );

        label.show = true;

        this._distance = distance;
    }

    // override
    reset() {
        this._point.show = false;
        this._drawing.prepareNewPrimitives();
    }

    /**
     * @returns {Boolean} true if the object has been destroyed, false otherwise.
     */
    // eslint-disable-next-line class-methods-use-this
    isDestroyed() {
        return false;
    }

    /**
     * Destroys the widget.
     */
    destroy() {
        this._drawing.destroy();

        this._removeEvent();
        return destroyObject(this);
    }

    loadData(data: PositionData[], id: string) {
        const positions = newCartesian3ArrayFromArray(data);

        positions.forEach((position) => {
            this._addPoint(position);
        });

        let distance = 0;

        for (let i = 0; i < positions.length - 1; i++) {
            distance += Cartesian3.distance(positions[i], positions[i + 1]);
        }

        const label = this._label;

        label.text = MeasureUnits.distanceToString(
            distance,
            this._selectedUnits.distanceUnits,
            this._selectedLocale,
            3
        );
        label.show = true;

        label.position = calculateMostTopPosition(this._scene, positions, new Cartesian3());

        this.saveCurrentMeasurementAndPrepareNew(id);

        this.reset();
    }

    saveCurrentMeasurementAndPrepareNew(id: string) {
        const drawing = this._drawing;

        const polyline = drawing.polyline;

        polyline.allowPicking = true;

        const polylineMeasurement = new PolylineMeasurement({
            id: id,
            label: this._label,
            labelCollection: this._labelCollection,
            segmentLabels: this._segmentLabels,
            polyline: new EditablePolyline({
                billboardCollection: this._billboardCollection,
                pointPrimitiveCollection: drawing.pointCollection,
                pointOptions: drawing.pointOptions,
                points: drawing.points,
                polyline: polyline
            }),
            measurementTool: this
        });

        if (polylineMeasurement.polyline.polylinePrimitive.positions.length === 2) {
            polylineMeasurement.label.show = false;
        }

        polylineMeasurement.updateLabels();

        this._measurements.push(polylineMeasurement);

        this._label = this._labelCollection.add(PrimitiveSettings.getLabelOptions());
        this._segmentLabels = [];
    }

    removeMeasurementById(id: string) {
        const measurementResult = this._measurements;

        const index = measurementResult.findIndex((measurement) => measurement.id === id);

        if (index === -1) {
            return false;
        }

        const foundMeasurement = measurementResult[index] as PolylineMeasurement;

        const labelCollection = this._labelCollection;
        labelCollection.remove(foundMeasurement.label);

        const labels = foundMeasurement.segmentLabels;

        for (let i = 0; i < labels.length; i++) {
            labelCollection.remove(labels[i]);
        }

        const points = foundMeasurement.pointPrimitives;

        for (let i = 0; i < points.length; i++) {
            this._drawing.pointCollection.remove(points[i]);
        }

        this._primitives.remove(foundMeasurement.polylinePrimitive);

        measurementResult.splice(index, 1);
        return true;
    }
}
