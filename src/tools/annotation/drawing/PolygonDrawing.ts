import { BoundingSphere, Cartesian3, Color } from "cesium";

import { EditablePolygon } from "../EditablePolygon";

import { DrawingType } from "./common";
import { Drawing } from "./Drawing";

export class PolygonDrawing extends Drawing {
    private readonly _polygon: EditablePolygon;
    constructor(options: { id: string; polygon: EditablePolygon }) {
        super({
            id: options.id,
            type: DrawingType.Polygon
        });

        this._polygon = options.polygon;
    }

    get pointPrimitives() {
        return this._polygon.pointPrimitives;
    }

    get polylinePrimitive() {
        return this._polygon.polylinePrimitive;
    }

    get polygon() {
        return this._polygon;
    }

    setColor(color: Color): void {
        this._polygon.polygonPrimitive.color = color;
    }

    showHide(show: boolean): void {
        this.pointPrimitives.forEach((point) => {
            point.show = show;
        });
        this.polylinePrimitive.show = show;
        this.polygon.polygonPrimitive.show = show;
    }

    getDetail(): object {
        return this.polygon.polygonPrimitive.positions;
    }

    isContain(primitive: any): boolean {
        return this._polygon.isContained(primitive);
    }

    get boundingSphere() {
        const positions: Cartesian3[] = [];

        this.polygon.pointPrimitives.forEach((point) => {
            positions.push(point.position);
        });

        return BoundingSphere.fromPoints(positions);
    }
}
