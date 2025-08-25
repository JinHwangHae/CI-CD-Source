import { Cartesian2, Cartesian3, Color, HeadingPitchRoll } from "cesium";

import { BaseDrawingTool } from "../BaseDrawingTool";

import { NoteDrawing } from "./NoteDrawing";
import { PolylineDrawing } from "./PolylineDrawing";
import { PolygonDrawing } from "./PolygonDrawing";
import { ImagePlane } from "./ImagePlane";
import { PaintDrawing } from "./PaintDrawing";

interface Position {
    x: number;
    y: number;
    z: number;
}

export interface NoteDrawingData {
    position: { x: number; y: number; z: number };
    color: Color;
    text: string;
    heading?: number;
    pitch?: number;
    distance?: number; // distance between dot circle and label
    showBillboard: boolean;
    showLabel: boolean;
    showLeader: boolean;
}

export interface PolylineDrawingData {
    positions: Position[];
    color: Color;
    width: number;
    clampToGround: boolean;
}

export interface PolygonDrawingData {
    positions: Position[];
    color: Color;
    width: number;
    clampToGround: boolean;
}

export interface ImagePlaneDrawingData {
    position: Cartesian3;
    normal: Cartesian3;
    dimensions: Cartesian2;
    distance: number;
    hpr: HeadingPitchRoll;
    url: string;
    keepImageAspect: boolean;
}

export interface PaintDrawingData {
    positions: Position[];
    color: Color;
    width: number;
}

declare type Drawing = NoteDrawing | PolylineDrawing | PolygonDrawing | ImagePlane | PaintDrawing;

export abstract class DrawingTool extends BaseDrawingTool {
    protected _drawings: Drawing[] = [];

    abstract loadData(
        data: NoteDrawingData | PolylineDrawingData | PolygonDrawingData | ImagePlaneDrawingData | PaintDrawingData,
        id: string
    ): void;

    abstract removeDrawingById(id: string): boolean;

    get drawings() {
        return this._drawings;
    }
}
