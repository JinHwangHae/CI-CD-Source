import { BillboardCollection, Cartesian3, Cartographic, createGuid, defined, PrimitiveCollection, Scene } from "cesium";

import {
    MapToolConstructorOptions,
    MouseEvent,
    PolygonDrawing as PolygonDrawingHanlder,
    PrimitiveSettings
} from "../../../core";
import { EditablePolygon } from "../EditablePolygon";
import { newCartesian3ArrayFromArray } from "../util";

import { PolygonDrawing } from "./PolygonDrawing";
import { DrawingTool, PolygonDrawingData } from "./DrawingTool";
import { Drawing } from "./Drawing";

declare type ConstructorOptions = MapToolConstructorOptions & {
    scene: Scene;
    primitives: PrimitiveCollection;
};

export class PolygonDrawingTool extends DrawingTool {
    private readonly _drawing: PolygonDrawingHanlder;
    private readonly _billboardCollection: BillboardCollection;

    constructor(options: ConstructorOptions) {
        super(options);

        this._billboardCollection = new BillboardCollection();
        this.scene.primitives.add(this._billboardCollection);

        this._drawing = new PolygonDrawingHanlder({
            scene: options.scene,
            primitives: options.primitives,
            pointOptions: PrimitiveSettings.getPointOptions(),
            polylineOptions: PrimitiveSettings.getPolylineOptions({
                allowPicking: false
            }),
            polygonOptions: PrimitiveSettings.getPolygonOptions({
                color: PrimitiveSettings.color.withAlpha(0.8),
                allowPicking: false
            })
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

        super.canvasMoveEvent(event);
    }

    canvasDoubleClickEvent() {
        this.finishDrawing();
    }

    finishDrawing(): void {
        const drawing = this._drawing;
        drawing.handleDoubleClick();

        const polyline = drawing.polyline;
        const polygon = drawing.polygon;

        polyline.allowPicking = true;
        polygon.allowPicking = true;

        this._drawings.push(
            new PolygonDrawing({
                id: createGuid(),
                polygon: new EditablePolygon({
                    billboardCollection: this._billboardCollection,
                    pointPrimitiveCollection: drawing.pointCollection,
                    pointOptions: drawing.pointOptions,
                    points: drawing.points,
                    polyline: polyline,
                    polygon: polygon
                })
            })
        );

        this._drawing.prepareNewPrimitives();

        // @ts-ignore
        this._drawingFinished.raiseEvent(this._drawings.length - 1);
    }

    loadData(data: PolygonDrawingData, id: string) {
        const positions = newCartesian3ArrayFromArray(data.positions);

        const drawing = this._drawing;

        positions.forEach((position) => {
            drawing.addPoint(position);
        });

        const polyline = drawing.polyline;
        const polygon = drawing.polygon;

        polyline.allowPicking = true;
        polygon.allowPicking = true;

        const polygonDrawing = new PolygonDrawing({
            id: id,
            polygon: new EditablePolygon({
                billboardCollection: this._billboardCollection,
                pointPrimitiveCollection: drawing.pointCollection,
                pointOptions: drawing.pointOptions,
                points: drawing.points,
                polyline: polyline,
                polygon: polygon
            })
        });

        polygonDrawing.setColor(data.color);
        polygonDrawing.polylinePrimitive.clampToGround = data.clampToGround;
        polygonDrawing.polygon.polygonPrimitive.clampToGround = data.clampToGround;

        this._drawings.push(polygonDrawing);

        drawing.prepareNewPrimitives();
    }

    removeDrawingById(id: string) {
        const drawingResults = this._drawings;

        const index = drawingResults.findIndex((drawingResult) => drawingResult.id === id);

        if (index === -1) {
            return false;
        }

        const foundDrawing = drawingResults[index] as PolygonDrawing;

        const drawing = this._drawing;

        const points = foundDrawing.pointPrimitives;

        for (let i = 0; i < points.length; i++) {
            drawing.pointCollection.remove(points[i]);
        }

        drawing.primitives.remove(foundDrawing.polylinePrimitive);
        drawing.primitives.remove(foundDrawing.polygon.polygonPrimitive);

        drawingResults.splice(index, 1);
        return true;
    }

    updateDrawing(drawing: Drawing) {
        const polygonDrawing = drawing as PolygonDrawing;

        const polygon = polygonDrawing.polygon;
        const positions = polygon.polygonPrimitive.positions;

        const updatedPositions: Cartesian3[] = [];

        const scene = this.scene;

        positions.forEach((pos) => {
            const carto = Cartographic.fromCartesian(pos);

            const h = scene.sampleHeight(carto);

            if (!defined(h)) {
                updatedPositions.push(Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height));
                return;
            }

            // Mariana Trench
            if (h < -10935) {
                updatedPositions.push(Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height));
                return;
            }

            updatedPositions.push(Cartesian3.fromRadians(carto.longitude, carto.latitude, h));
        });

        polygon.updatePositions(updatedPositions);
    }

    updateDrawings() {
        this._drawings.forEach((drawing) => {
            this.updateDrawing(drawing);
        });
    }
}
