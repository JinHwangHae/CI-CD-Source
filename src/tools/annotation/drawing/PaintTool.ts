/* qeslint-disable */
// q@ts-nocheck

import { Cartesian3, createGuid, PointPrimitiveCollection, PrimitiveCollection } from "cesium";

import {
    getWorldPositionOn3DTiles,
    MapToolConstructorOptions,
    MouseButton,
    MouseEvent,
    PolylinePrimitive,
    PrimitiveSettings
} from "../../../core";
import { newCartesian3ArrayFromArray } from "../util";
import { DrawingTool, PaintDrawingData } from "./DrawingTool";
import { PaintDrawing } from "./PaintDrawing";

const scratchPickedPosition = new Cartesian3();

declare type ConstructorOptions = MapToolConstructorOptions & {
    primitives: PrimitiveCollection;
};

export class PaintTool extends DrawingTool {
    private _leftDown = false;
    private _drawing: PaintDrawing | undefined;
    private readonly _primitiveCollection: PrimitiveCollection;

    constructor(options: ConstructorOptions) {
        super(options);

        this._primitiveCollection = options.primitives;
    }

    activate(): void {
        super.activate();
    }

    canvasMoveEvent(event: MouseEvent): void {
        if (!this._leftDown) {
            return;
        }

        if (!this._drawing) {
            return;
        }

        const pickedPosition = getWorldPositionOn3DTiles(this.scene, event.pos, scratchPickedPosition);

        if (!pickedPosition) {
            return;
        }

        const lastPoint = this._drawing.getLastPoint();

        const distance = Cartesian3.distance(lastPoint.position, pickedPosition);

        if (distance < 0.01) {
            return;
        }

        this._drawing.addNew(Cartesian3.clone(pickedPosition, new Cartesian3()));
    }

    canvasPressEvent(event: MouseEvent) {
        const scene = this.scene;
        const pickedPosition = getWorldPositionOn3DTiles(scene, event.pos, scratchPickedPosition);

        if (!pickedPosition) {
            return;
        }

        if (event.button === MouseButton.LeftButton) {
            this._leftDown = true;

            scene.screenSpaceCameraController.enableRotate = false;
        }

        const polylineOptions = PrimitiveSettings.getPolylineOptions({});

        this._drawing = new PaintDrawing({
            id: createGuid(),
            pointPrimitives: this._primitiveCollection.add(new PointPrimitiveCollection()),
            polylinePrimitive: this._primitiveCollection.add(new PolylinePrimitive(polylineOptions))
        });

        this._drawing.addNew(Cartesian3.clone(pickedPosition, new Cartesian3()));
    }

    canvasReleaseEvent(/* event: MouseEvent */): void {
        this._leftDown = false;
        this.scene.screenSpaceCameraController.enableRotate = true;

        if (!this._drawing) {
            return;
        }

        this._drawings.push(this._drawing);

        // @ts-ignore
        this._drawingFinished.raiseEvent(this._drawings.length - 1);
    }

    loadData(data: PaintDrawingData, id: string) {
        const positions = newCartesian3ArrayFromArray(data.positions);

        const polylineOptions = PrimitiveSettings.getPolylineOptions({ color: data.color, width: data.width });

        const drawing = new PaintDrawing({
            id: id,
            pointPrimitives: this._primitiveCollection.add(new PointPrimitiveCollection()),
            polylinePrimitive: this._primitiveCollection.add(new PolylinePrimitive(polylineOptions))
        });

        positions.forEach((position) => {
            drawing.addNew(position);
        });

        this._drawings.push(drawing);
    }

    removeDrawingById(id: string) {
        const drawingResults = this._drawings;

        const index = drawingResults.findIndex((drawingResult) => drawingResult.id === id);

        if (index === -1) {
            return false;
        }

        const foundDrawing = drawingResults[index] as PaintDrawing;

        this._primitiveCollection.remove(foundDrawing.pointPrimitives);
        this._primitiveCollection.remove(foundDrawing.polylinePrimitive);

        drawingResults.splice(index, 1);

        return true;
    }
}
