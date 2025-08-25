import { BillboardCollection, createGuid, PrimitiveCollection, Scene } from "cesium";

import {
    MapToolConstructorOptions,
    MouseEvent,
    PolylineDrawing as PolylineDrawingHandler,
    PrimitiveSettings
} from "../../../core";

import { newCartesian3ArrayFromArray } from "../util";
import { PolylineDrawing } from "./PolylineDrawing";
import { DrawingTool, PolylineDrawingData } from "./DrawingTool";
import { EditablePolyline } from "../EditablePolyline";

declare type ConstructorOptions = MapToolConstructorOptions & {
    scene: Scene;
    primitives: PrimitiveCollection;
};

export class PolylineDrawingTool extends DrawingTool {
    private readonly _drawing: PolylineDrawingHandler;
    private readonly _billboardCollection: BillboardCollection;

    constructor(options: ConstructorOptions) {
        super(options);

        this._billboardCollection = new BillboardCollection();
        this.scene.primitives.add(this._billboardCollection);

        this._drawing = new PolylineDrawingHandler({
            scene: options.scene,
            primitives: options.primitives,
            pointOptions: PrimitiveSettings.getPointOptions({}),
            polylineOptions: PrimitiveSettings.getPolylineOptions({ allowPicking: false })
        });
    }

    activate(): void {
        super.activate();

        this._drawing.reset();
    }

    deactivate(): void {
        super.deactivate();

        this._drawing.reset();
    }

    canvasClickEvent(event: MouseEvent) {
        const position = this._drawing.handleClick(event.pos);

        if (position && this._drawing.positions.length === 1) {
            this._drawingStarted.raiseEvent();
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    canvasDoubleClickEvent(event: MouseEvent) {
        this.finishDrawing();
    }

    canvasMoveEvent(event: MouseEvent): void {
        if (event.button !== undefined) {
            return;
        }

        super.canvasMoveEvent(event);

        const drawing = this._drawing;

        drawing.handleMouseMove(event.pos);
    }

    finishDrawing(): void {
        const drawing = this._drawing;
        drawing.handleDoubleClick();

        const polyline = drawing.polyline;

        polyline.allowPicking = true;

        this._drawings.push(
            new PolylineDrawing({
                id: createGuid(),
                polyline: new EditablePolyline({
                    billboardCollection: this._billboardCollection,
                    pointPrimitiveCollection: drawing.pointCollection,
                    pointOptions: drawing.pointOptions,
                    points: drawing.points,
                    polyline: drawing.polyline
                })
            })
        );

        this._drawing.prepareNewPrimitives();

        // @ts-ignore
        this._drawingFinished.raiseEvent(this._drawings.length - 1);
    }

    loadData(data: PolylineDrawingData, id: string) {
        const positions = newCartesian3ArrayFromArray(data.positions);

        const drawing = this._drawing;

        positions.forEach((position) => {
            drawing.addPoint(position);
        });

        const polyline = drawing.polyline;

        polyline.allowPicking = true;

        const polylineDrawing = new PolylineDrawing({
            id: id,
            polyline: new EditablePolyline({
                billboardCollection: this._billboardCollection,
                pointPrimitiveCollection: drawing.pointCollection,
                pointOptions: drawing.pointOptions,
                points: drawing.points,
                polyline: polyline
            })
        });

        polylineDrawing.polylinePrimitive.clampToGround = data.clampToGround;

        this._drawings.push(polylineDrawing);

        drawing.prepareNewPrimitives();
    }

    removeDrawingById(id: string) {
        const drawingResults = this._drawings;

        const index = drawingResults.findIndex((drawingResult) => drawingResult.id === id);

        if (index === -1) {
            return false;
        }

        const foundDrawing = drawingResults[index] as PolylineDrawing;

        const drawing = this._drawing;

        for (let i = 0; i < foundDrawing.pointPrimitives.length; i++) {
            drawing.pointCollection.remove(foundDrawing.pointPrimitives[i]);
        }

        drawing.primitives.remove(foundDrawing.polylinePrimitive);

        drawingResults.splice(index, 1);
        return true;
    }
}
