/* qeslint-disable */
// q@ts-nocheck

import { BillboardCollection, LabelCollection, PrimitiveCollection, Viewer } from "cesium";

import { CanvasEventHandlerParent, MapTools } from "../../../core";

import { DrawingTool } from "./DrawingTool";
import { ImagePlaneTool } from "./ImagePlaneTool";
import { NoteDrawingTool } from "./NoteDrawingTool";
import { PaintTool } from "./PaintTool";
import { PolylineDrawingTool } from "./PolylineDrawingTool";
import { PolygonDrawingTool } from "./PolygonDrawingTool";

export class DrawingTools extends MapTools {
    constructor(options: { parent: CanvasEventHandlerParent; viewer: Viewer }) {
        super(options);

        const scene = options.viewer.scene;

        const primitiveCollection = new PrimitiveCollection();

        // @ts-ignore
        primitiveCollection.id = "DrawingTools-PrimitiveCollection";

        const primitives = scene.primitives.add(primitiveCollection);
        const labels = primitives.add(new LabelCollection());
        const billboards = primitives.add(new BillboardCollection());

        this.addTool(
            new NoteDrawingTool({
                name: "NoteDrawingTool",
                viewer: options.viewer,
                scene: scene,
                primitives: primitives,
                labels: labels,
                billboards: billboards
            })
        );

        this.addTool(
            new PolylineDrawingTool({
                name: "PolylineDrawingTool",
                viewer: options.viewer,
                scene: scene,
                primitives: primitives
            })
        );

        this.addTool(
            new PolygonDrawingTool({
                name: "PolygonDrawingTool",
                viewer: options.viewer,
                scene: scene,
                primitives: primitives
            })
        );

        this.addTool(
            new ImagePlaneTool({
                name: "ImagePlaneTool",
                viewer: options.viewer
            })
        );

        this.addTool(
            new PaintTool({
                name: "PaintTool",
                viewer: options.viewer,
                primitives: primitives
            })
        );
    }

    get noteDrawingTool() {
        return this.tools[0] as NoteDrawingTool;
    }

    get polylineDrawingTool() {
        return this.tools[1] as PolylineDrawingTool;
    }

    get polygonDrawingTool() {
        return this.tools[2] as PolygonDrawingTool;
    }

    get imagePlaneTool() {
        return this.tools[3] as ImagePlaneTool;
    }

    get paintTool() {
        return this.tools[4] as PaintTool;
    }

    activateNoteDrawingTool() {
        this.selectTool(this.noteDrawingTool);
    }

    activatePolylineDrawingTool() {
        this.selectTool(this.polylineDrawingTool);
    }

    activatePolygonDrawingTool() {
        this.selectTool(this.polygonDrawingTool);
    }

    activatePaintTool() {
        this.selectTool(this.paintTool);
    }

    getDrawingById(id: string) {
        for (let i = 0; i < this.tools.length; i++) {
            const tool = this.tools[i] as DrawingTool;

            for (let j = 0; j < tool.drawings.length; j++) {
                if (tool.drawings[j].id === id) {
                    return tool.drawings[j];
                }
            }
        }

        return undefined;
    }

    showHideDrawingById(id: string, show: boolean) {
        const drawing = this.getDrawingById(id);

        if (!drawing) {
            console.warn(`failed to find drawing id: ${id}`);
            return;
        }

        drawing.showHide(show);
    }

    removeDrawingById(id: string) {
        let removed = false;

        this.tools.forEach((tool) => {
            const drawingTool = tool as DrawingTool;

            removed = drawingTool.removeDrawingById(id);
        });

        return removed;
    }

    getDrawingByPrimitive(primitive: any) {
        for (let i = 0; i < this.tools.length; i++) {
            const tool = this.tools[i] as DrawingTool;

            for (let j = 0; j < tool.drawings.length; j++) {
                if (tool.drawings[j].isContain(primitive)) {
                    return tool.drawings[j];
                }
            }
        }

        return undefined;
    }

    updateDrawings() {
        this.polygonDrawingTool.updateDrawings();
    }
}
