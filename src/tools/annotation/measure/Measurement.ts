import { Event } from "cesium";
import { MeasurementType } from "./MeasurementType";

export abstract class Measurement {
    private _id: string;
    private readonly _type: MeasurementType;
    private _updated: Event;
    private _removeUpdateListener: Event.RemoveCallback | undefined;

    constructor(options: { id: string; type: MeasurementType }) {
        this._id = options.id;
        this._type = options.type;
        this._updated = new Event();
    }

    get id() {
        return this._id;
    }

    set id(id) {
        this._id = id;
    }

    get type() {
        return this._type;
    }

    get updated() {
        return this._updated;
    }

    get removeUpdatedListener() {
        return this._removeUpdateListener;
    }

    set removeUpdatedListener(fn: Event.RemoveCallback | undefined) {
        this._removeUpdateListener = fn;
    }

    abstract getDetail(): Object;
    abstract showHide(show: boolean): void;
    abstract isContain(primitive: any): boolean;
    // eslint-disable-next-line class-methods-use-this
    measurementString() {
        return "";
    }
}
