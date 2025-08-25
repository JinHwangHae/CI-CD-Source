/* qeslint-disable */
// q@ts-nocheck

import { BillboardCollection, Cartesian3, createGuid, destroyObject, Event, Label } from "cesium";

import {
    calculateAreaOfPolygon,
    DrawingMode,
    MeasureUnits,
    MouseEvent,
    PolygonDrawing,
    PrimitiveSettings
} from "../../../core";
import { newCartesian3ArrayFromArray } from "../util";
import { EditablePolygon } from "../EditablePolygon";

import { MeasurementTool, MeasurementToolConstructorOptions, PositionData } from "./MeasurementTool";
import { calculateMostTopPosition } from "./common";
import { AreaMeasurement } from "./AreaMeasurement";

/**
 * Creates a polygonal area measurement.
 */
export class AreaMeasurementTool extends MeasurementTool {
    private readonly _drawing: PolygonDrawing;
    private readonly _billboardCollection: BillboardCollection;
    private _area: number;
    private _label: Label;

    private _removeEvent: Event.RemoveCallback;

    constructor(options: MeasurementToolConstructorOptions) {
        super(options);

        this._billboardCollection = new BillboardCollection();
        this.scene.primitives.add(this._billboardCollection);

        const drawingOptions = {
            scene: this.scene,
            primitives: options.primitives,
            pointOptions: PrimitiveSettings.getPointOptions(),
            polylineOptions: PrimitiveSettings.getPolylineOptions({ allowPicking: false }),
            polygonOptions: PrimitiveSettings.getPolygonOptions({ allowPicking: false })
        };

        this._drawing = new PolygonDrawing(drawingOptions);

        this._label = this._labelCollection.add(PrimitiveSettings.getLabelOptions());

        this._area = 0;

        this._removeEvent = this._scene.preRender.addEventListener(() => {
            this.updateLabel();
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
    }

    get area() {
        return this._area;
    }

    get label() {
        return this._label;
    }

    updateArea(positions: Cartesian3[]) {
        const area = calculateAreaOfPolygon(positions);

        this._area = area;
        this._label.text = MeasureUnits.areaToString(area, this._selectedUnits.areaUnits, this._selectedLocale, 3);
    }

    updateLabel() {
        const positions = this._drawing.positions;

        if (positions.length < 2) {
            return;
        }

        const scene = this._scene;
        const newPos = calculateMostTopPosition(scene, positions, new Cartesian3());
        this._label.position = newPos;
    }

    canvasDoubleClickEvent(): void {
        this.finishDrawing();
    }

    finishDrawing(): void {
        this._drawing.handleDoubleClick();

        this.saveCurrentMeasurementAndPrepareNew(createGuid());

        // @ts-ignore
        this._drawingFinished.raiseEvent(this._measurements.length - 1);
    }

    canvasClickEvent(event: MouseEvent): void {
        const drawing = this._drawing;

        if (drawing.mode === DrawingMode.AfterDraw) {
            drawing.prepareNewPrimitives();
        }

        const position = drawing.handleClick(event.pos);

        if (position) {
            this._label.show = true;
            drawing.polygon.show = true;
            drawing.polyline.show = true;
        }

        if (position && this._drawing.polygon.positions.length === 1) {
            this._drawingStarted.raiseEvent();
        }
    }

    canvasMoveEvent(event: MouseEvent): void {
        if (event.button !== undefined) {
            return;
        }

        const nextPos = this._drawing.handleMouseMove(event.pos);

        if (!nextPos) {
            return;
        }

        const positions = this._drawing.positions.slice();

        positions.push(nextPos);
        this.updateArea(positions);
    }

    reset() {
        this._drawing.prepareNewPrimitives();
        this._point.show = false;
    }

    // eslint-disable-next-line class-methods-use-this
    isDestroyed() {
        return false;
    }

    destroy() {
        this._drawing.destroy();
        this._removeEvent();

        return destroyObject(this);
    }

    loadData(data: PositionData[], id: string) {
        const positions = newCartesian3ArrayFromArray(data);

        const drawing = this._drawing;

        drawing.polyline.positions = positions;
        drawing.polygon.positions = positions;
        this._label.show = true;

        this.updateArea(positions);

        for (let i = 0; i < positions.length; i++) {
            const point = drawing.pointCollection.add(drawing.pointOptions);

            point.position = positions[i];
            point.show = true;
            drawing.points.push(point);
        }

        const scene = this._scene;

        this._label.position = calculateMostTopPosition(scene, positions, new Cartesian3());
        this._label.show = true;
        drawing.polyline.show = true;
        drawing.polygon.show = true;

        this.saveCurrentMeasurementAndPrepareNew(id);
    }

    saveCurrentMeasurementAndPrepareNew(id: string) {
        // we save current measurement and prepare new fresh

        const drawing = this._drawing;

        const polyline = drawing.polyline;
        const polygon = drawing.polygon;

        polyline.allowPicking = true;
        polygon.allowPicking = true;

        this._measurements.push(
            new AreaMeasurement({
                id: id,
                label: this._label,
                polygon: new EditablePolygon({
                    billboardCollection: this._billboardCollection,
                    pointPrimitiveCollection: drawing.pointCollection,
                    pointOptions: drawing.pointOptions,
                    points: drawing.points,
                    polyline: polyline,
                    polygon: polygon
                }),
                measurementTool: this
            })
        );

        this._label = this._labelCollection.add(PrimitiveSettings.getLabelOptions());
        drawing.prepareNewPrimitives();
    }

    removeMeasurementById(id: string) {
        const measurementResult = this._measurements;

        const index = measurementResult.findIndex((measurement) => measurement.id === id);

        if (index === -1) {
            return false;
        }

        const foundMeasurement = measurementResult[index] as AreaMeasurement;

        this._labelCollection.remove(foundMeasurement.labelPrimitive);
        this._primitives.remove(foundMeasurement.polygonPrimitive);
        this._primitives.remove(foundMeasurement.polylinePrimitive);

        const points = foundMeasurement.pointPrimitives;

        for (let i = 0; i < points.length; i++) {
            this._drawing.pointCollection.remove(points[i]);
        }

        measurementResult.splice(index, 1);

        return true;
    }
}
