import { Color } from "cesium";

import { EditablePolyline } from "../EditablePolyline";

import { DrawingType } from "./common";
import { Drawing } from "./Drawing";

export class PolylineDrawing extends Drawing {
    private readonly _polyline: EditablePolyline;

    constructor(options: { id: string; polyline: EditablePolyline }) {
        super({
            id: options.id,
            type: DrawingType.Polyline
        });

        this._polyline = options.polyline;
    }

    get pointPrimitives() {
        return this._polyline.pointPrimitives;
    }

    get polylinePrimitive() {
        return this._polyline.polylinePrimitive;
    }

    get polyline() {
        return this._polyline;
    }

    setWidth(width: number) {
        this.polylinePrimitive.width = width;
    }

    setColor(color: Color): void {
        this.polylinePrimitive.color = color;
    }

    showHide(show: boolean): void {
        this.pointPrimitives.forEach((point) => {
            point.show = show;
        });

        this.polylinePrimitive.show = show;
    }

    getDetail(): object {
        return this.polylinePrimitive.positions;
    }

    isContain(primitive: any): boolean {
        return this._polyline.isContained(primitive);
    }
}
