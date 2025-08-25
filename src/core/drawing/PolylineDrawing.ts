/* qeslint-disable */
// q@ts-nocheck

import {
    destroyObject,
    Cartesian2,
    Cartesian3,
    PointPrimitive,
    PointPrimitiveCollection,
    Scene,
    PrimitiveCollection
} from "cesium";

import { getWorldPosition } from "../getWorldPosition";
import { PointOptions, PolylineOptions } from "../PrimitiveSettings";

import { DrawingMode } from "./DrawingMode";
import { PolylinePrimitive } from "../primitives";

const clickDistanceScratch = new Cartesian2();
const cart3Scratch = new Cartesian3();

const mouseDelta = 10;

interface PolylineDrawingConstructorOptions {
    scene: Scene;
    primitives: PrimitiveCollection;
    pointOptions: PointOptions;
    polylineOptions: PolylineOptions;
}

export class PolylineDrawing {
    protected readonly _scene: Scene;
    protected _mode: DrawingMode;
    protected _polyline: PolylinePrimitive;
    protected _positions: Cartesian3[];
    protected _primitives: PrimitiveCollection;
    protected readonly _pointCollection: PointPrimitiveCollection;
    protected _points: PointPrimitive[];
    private _tempNextPos: Cartesian3;
    protected _lastClickPosition: Cartesian2;
    private readonly _pointOptions: PointOptions;
    private readonly _polylineOptions: PolylineOptions;

    constructor(options: PolylineDrawingConstructorOptions) {
        const scene = options.scene;
        const primitives = options.primitives;
        this._scene = scene;
        this._polyline = primitives.add(new PolylinePrimitive(options.polylineOptions));
        this._pointCollection = primitives.add(new PointPrimitiveCollection());
        this._primitives = primitives;
        this._pointOptions = options.pointOptions;
        this._positions = [];
        this._points = [];
        this._tempNextPos = new Cartesian3();
        this._mode = DrawingMode.BeforeDraw;
        this._lastClickPosition = new Cartesian2(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
        this._polylineOptions = options.polylineOptions;
    }

    get primitives() {
        return this._primitives;
    }

    get pointCollection() {
        return this._pointCollection;
    }

    get points() {
        return this._points;
    }

    set points(points) {
        this._points = points;
    }

    get positions() {
        return this._positions;
    }

    set positions(positions) {
        this._positions = positions;
    }

    get polyline() {
        return this._polyline;
    }

    get mode() {
        return this._mode;
    }

    set mode(mode) {
        this._mode = mode;
    }

    get pointOptions() {
        return this._pointOptions;
    }

    addPoint(position: Cartesian3) {
        const positions = this._positions;
        positions.push(position);
        this._polyline.positions = positions;
        const point = this._pointCollection.add(this._pointOptions);
        point.position = position;
        point.show = true;
        this._points.push(point);
    }

    handleDoubleClick() {
        // expect point to be added by handleClick
        this._mode = DrawingMode.AfterDraw;

        // Sometimes a move event is fired between the ending
        // click and doubleClick events, so make sure the polyline
        // has the correct positions.
        this._polyline.positions = this._positions;
    }

    handleClick(clickPosition: Cartesian2) {
        if (this._mode === DrawingMode.AfterDraw) {
            return undefined;
        }

        // Don't handle if clickPos is too close to previous click.
        // This typically indicates a double click handler will be fired next,
        // we don't expect the user to wait and click this point again.
        const lastClickPos = this._lastClickPosition;
        const distance = Cartesian2.magnitude(Cartesian2.subtract(lastClickPos, clickPosition, clickDistanceScratch));
        if (distance < mouseDelta) {
            return undefined;
        }

        const position = getWorldPosition(this._scene, clickPosition, cart3Scratch);

        if (!position) {
            return undefined;
        }

        this.addPoint(Cartesian3.clone(position, new Cartesian3()));
        this._mode = DrawingMode.Drawing;
        Cartesian2.clone(clickPosition, lastClickPos);

        return position;
    }

    handleMouseMove(mousePosition: Cartesian2) {
        if (this._mode !== DrawingMode.Drawing) {
            return undefined;
        }
        const scene = this._scene;
        const nextPos = getWorldPosition(scene, mousePosition, cart3Scratch);

        if (!nextPos) {
            return undefined;
        }

        const positions = this._positions.slice();
        positions.push(Cartesian3.clone(nextPos, this._tempNextPos));
        this._polyline.positions = positions;

        return nextPos;
    }

    reset() {
        this._polyline.positions = [];
        const points = this._points;
        const pointCollection = this._pointCollection;

        for (let i = 0; i < points.length; i++) {
            pointCollection.remove(points[i]);
        }
        this._points = [];
        this._positions = [];
        this._mode = DrawingMode.BeforeDraw;
    }

    prepareNewPrimitives() {
        // note that old primitives are not removed

        this._polyline = this._primitives.add(new PolylinePrimitive(this._polylineOptions));
        this._points = [];
        this._positions = [];
    }

    // eslint-disable-next-line class-methods-use-this
    isDestroyed() {
        return false;
    }

    destroy() {
        const points = this._points;
        const pointCollection = this._pointCollection;

        for (let i = 0; i < points.length; i++) {
            pointCollection.remove(points[i]);
        }
        this._primitives.remove(this._polyline);

        return destroyObject(this);
    }
}
