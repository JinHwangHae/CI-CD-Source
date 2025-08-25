import { Event } from "cesium";

import { MapTool, MapToolConstructorOptions } from "../../core";

export abstract class BaseDrawingTool extends MapTool {
    protected readonly _drawingStarted: Event;
    protected readonly _drawingFinished: Event;

    constructor(options: MapToolConstructorOptions) {
        super(options);

        this._drawingFinished = new Event();
        this._drawingStarted = new Event();
    }

    // eslint-disable-next-line class-methods-use-this
    finishDrawing() {}

    get drawingStarted() {
        return this._drawingStarted;
    }

    get drawingFinished() {
        return this._drawingFinished;
    }
}
