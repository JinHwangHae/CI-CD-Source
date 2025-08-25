/* qeslint-disable */
// q@ts-nocheck

import { Cartesian3, Color, PointPrimitiveCollection } from "cesium";

import { PolylinePrimitive, PrimitiveSettings } from "../../../core";
import { DrawingType } from "./common";
import { Drawing } from "./Drawing";

interface ConstructorOptions {
    id: string;
    pointPrimitives: PointPrimitiveCollection;
    polylinePrimitive: PolylinePrimitive;
}

export class PaintDrawing extends Drawing {
    private readonly _pointPrimitives: PointPrimitiveCollection;
    private readonly _polylinePrimitive: PolylinePrimitive;

    constructor(options: ConstructorOptions) {
        super({
            id: options.id,
            type: DrawingType.Paint
        });

        this._pointPrimitives = options.pointPrimitives;
        this._polylinePrimitive = options.polylinePrimitive;
    }

    get pointPrimitives() {
        return this._pointPrimitives;
    }

    get polylinePrimitive() {
        return this._polylinePrimitive;
    }

    addNew(position: Cartesian3) {
        const pointOptions = PrimitiveSettings.getPointOptions({ position: position, show: false });

        this._pointPrimitives.add(pointOptions);

        this._polylinePrimitive.addPosition(position);
    }

    getLastPoint() {
        return this._pointPrimitives.get(this._pointPrimitives.length - 1);
    }

    setColor(color: Color): void {
        for (let i = 0; i < this._pointPrimitives.length; i++) {
            this._pointPrimitives.get(i).color = color;
        }

        this._polylinePrimitive.color = color;
    }

    getDetail() {
        const positions = [];

        for (let i = 0; i < this._pointPrimitives.length; i++) {
            positions.push(this._pointPrimitives.get(i).position);
        }

        return { positions: positions };
    }

    showHide(show: boolean): void {
        this._pointPrimitives.show = show;
        this._polylinePrimitive.show = show;
    }

    isContain(primitive: any): boolean {
        for (let i = 0; i < this._pointPrimitives.length; i++) {
            if (Object.is(primitive, this._pointPrimitives.get(i))) {
                return true;
            }
        }

        return false;
    }
}
