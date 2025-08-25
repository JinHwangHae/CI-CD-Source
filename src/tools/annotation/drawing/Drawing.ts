import { BoundingSphere, Color } from "cesium";

import { DrawingType } from "./common";

export abstract class Drawing {
    private readonly _id: string;
    private readonly _type: DrawingType;

    constructor(options: { id: string; type: DrawingType }) {
        this._id = options.id;
        this._type = options.type;
    }

    get id() {
        return this._id;
    }

    get type() {
        return this._type;
    }

    abstract setColor(color: Color): void;
    abstract showHide(show: boolean): void;
    abstract getDetail(): object;
    abstract isContain(primitive: any): boolean;

    // eslint-disable-next-line class-methods-use-this
    get boundingSphere() {
        return new BoundingSphere();
    }
}
