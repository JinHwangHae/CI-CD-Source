import {
    Billboard,
    BillboardCollection,
    Cartesian3,
    Color,
    DeveloperError,
    Event,
    PointPrimitive,
    PointPrimitiveCollection
} from "cesium";

import { PointOptions, PolylinePrimitive } from "../../core";
import { editingPointOptions } from "./EditCommon";

const cart3Scratch1 = new Cartesian3();

export class EditablePolyline {
    private readonly _billboardCollection: BillboardCollection;
    private readonly _pointPrimitiveCollection: PointPrimitiveCollection;
    private readonly _pointOptions: PointOptions;
    private readonly _points: PointPrimitive[];
    private readonly _polyline: PolylinePrimitive;
    private readonly _middleVertices: Billboard[] = [];
    private readonly _originalPositions: Cartesian3[];
    private readonly _originalColor: Color;
    private readonly _middleVertexOptions = {
        image: `${window.Construkted.imageRootUrl()}/add.png`,
        disableDepthTestDistance: Infinity
    };

    private readonly _vertexChanged: Event;

    constructor(options: {
        billboardCollection: BillboardCollection;
        pointPrimitiveCollection: PointPrimitiveCollection;
        pointOptions: PointOptions;
        points: PointPrimitive[];
        polyline: PolylinePrimitive;
    }) {
        this._billboardCollection = options.billboardCollection;
        this._pointPrimitiveCollection = options.pointPrimitiveCollection;
        this._pointOptions = options.pointOptions;

        this._points = options.points;
        this._polyline = options.polyline;

        this._originalPositions = [];
        this._polyline.positions.forEach((position) => {
            this._originalPositions.push(position.clone(new Cartesian3()));
        });
        this._originalColor = new Color();
        this._polyline.color.clone(this._originalColor);
        this._vertexChanged = new Event();
    }

    get pointPrimitiveCollection() {
        return this._pointPrimitiveCollection;
    }

    get pointPrimitives() {
        return this._points;
    }

    get polylinePrimitive() {
        return this._polyline;
    }

    get middleVertices() {
        return this._middleVertices!;
    }

    get vertexChanged() {
        return this._vertexChanged;
    }

    startEditing() {
        this._points.forEach((point) => {
            point.color = editingPointOptions.color;
            point.pixelSize = editingPointOptions.pixelSize;
            point.outlineWidth = editingPointOptions.outlineWidth;
            point.outlineColor = editingPointOptions.outlineColor;
        });

        this._createMiddleVertices();
    }

    private _createMiddleVertices() {
        const positions = this._polyline.positions;

        for (let i = 0; i < positions.length - 1; i++) {
            const firstPosition = positions[i];

            const nextPosition = positions[i + 1];

            const midPosition = Cartesian3.midpoint(firstPosition, nextPosition, new Cartesian3());

            const middleVertex = this._billboardCollection.add({
                ...this._middleVertexOptions,
                position: midPosition
            });

            this._middleVertices.push(middleVertex);
        }
    }

    restoreMainVertices() {
        this._points.forEach((point) => {
            point.color = this._pointOptions.color!;
            point.pixelSize = this._pointOptions.pixelSize!;
        });

        this._points.forEach((point) => {
            this._pointPrimitiveCollection.remove(point);
        });

        this._points.length = 0;

        const positions = this._polyline.positions;

        positions.forEach((position) => {
            const point = this._pointPrimitiveCollection.add({
                ...this._pointOptions,
                show: true,
                position: position
            });

            this._points.push(point);
        });
    }

    removeMiddleVertices() {
        for (let i = 0; i < this._middleVertices.length; i++) {
            this._billboardCollection.remove(this._middleVertices[i]);
        }

        this._middleVertices.length = 0;
    }

    isContainedVertex(point: PointPrimitive) {
        for (let i = 0; i < this._points.length; i++) {
            if (Object.is(point, this._points[i])) {
                return true;
            }
        }

        for (let i = 0; i < this._middleVertices.length; i++) {
            if (Object.is(point, this._middleVertices[i])) {
                return true;
            }
        }

        return false;
    }

    indexOfMainVertices(primitive: any) {
        for (let i = 0; i < this._points.length; i++) {
            if (Object.is(primitive, this._points[i])) {
                return i;
            }
        }

        return -1;
    }

    indexOfMiddleVertices(primitive: any) {
        for (let i = 0; i < this._middleVertices.length; i++) {
            if (Object.is(primitive, this._middleVertices[i])) {
                return i;
            }
        }

        return -1;
    }

    updateMainVertex(indexOfMainVertex: number, position: Cartesian3) {
        if (indexOfMainVertex < 0 || indexOfMainVertex > this._polyline.positions.length - 1) {
            throw new DeveloperError("error");
        }

        this._points[indexOfMainVertex].position = position;

        this._polyline.updatePosition(indexOfMainVertex, position);

        const positions = this._polyline.positions;
        const positionCount = positions.length;

        if (indexOfMainVertex === 0) {
            this._middleVertices[0].position = Cartesian3.midpoint(position, positions[1], cart3Scratch1);
        } else if (indexOfMainVertex === positionCount - 1) {
            this._middleVertices[indexOfMainVertex - 1].position = Cartesian3.midpoint(
                position,
                positions[indexOfMainVertex - 1],
                cart3Scratch1
            );
        } else {
            this._middleVertices[indexOfMainVertex - 1].position = Cartesian3.midpoint(
                position,
                positions[indexOfMainVertex - 1],
                cart3Scratch1
            );
            this._middleVertices[indexOfMainVertex].position = Cartesian3.midpoint(
                position,
                positions[indexOfMainVertex + 1],
                cart3Scratch1
            );
        }

        this._vertexChanged.raiseEvent();
    }

    insertMainVertex(indexOfMiddleVertex: number) {
        const middleVertex = this._middleVertices[indexOfMiddleVertex];

        const newMainVertex = this._pointPrimitiveCollection.add({
            ...this._pointOptions,
            ...editingPointOptions,
            show: true,
            position: middleVertex.position
        });

        this._points.splice(indexOfMiddleVertex + 1, 0, newMainVertex);

        const middleVertexPosition = middleVertex.position;

        const positions = this._polyline.positions;

        positions.splice(indexOfMiddleVertex + 1, 0, middleVertexPosition);

        this._billboardCollection.remove(middleVertex);

        this._polyline.forceUpdate();

        const newMiddleVertex1 = this._billboardCollection.add({
            ...this._middleVertexOptions,
            position: Cartesian3.midpoint(positions[indexOfMiddleVertex], middleVertexPosition, new Cartesian3())
        });

        const newMiddleVertex2 = this._billboardCollection.add({
            ...this._middleVertexOptions,
            position: Cartesian3.midpoint(middleVertexPosition, positions[indexOfMiddleVertex + 1], new Cartesian3())
        });

        this._middleVertices.splice(indexOfMiddleVertex, 1, newMiddleVertex1, newMiddleVertex2);

        return newMainVertex;
    }

    revertToOriginal() {
        this.removeMiddleVertices();

        this._points.forEach((point) => {
            this._pointPrimitiveCollection.remove(point);
        });

        this._points.length = 0;

        this._originalPositions.forEach((position) => {
            const point = this._pointPrimitiveCollection.add({
                ...this._pointOptions,
                show: true,
                position: position
            });
            this._points.push(point);
        });

        const positions: Cartesian3[] = [];

        this._originalPositions.forEach((position) => {
            positions.push(position.clone(new Cartesian3()));
        });

        this._polyline.positions = positions;

        this._polyline.color = this._originalColor;

        this._vertexChanged.raiseEvent();
    }

    removeMainVertex(indexOfMainVertex: number) {
        const positions = this._polyline.positions;

        if (positions.length <= 2) {
            return;
        }

        positions.splice(indexOfMainVertex, 1);

        this._polyline.forceUpdate();

        const mainVertex = this._points[indexOfMainVertex];

        this._points.splice(indexOfMainVertex, 1);

        this._pointPrimitiveCollection.remove(mainVertex);

        this._middleVertices.forEach((point) => {
            this._billboardCollection.remove(point);
        });

        this._middleVertices.length = 0;

        this._createMiddleVertices();

        this._vertexChanged.raiseEvent();
    }

    isContained(primitive: any): boolean {
        const index = this.indexOfMainVertices(primitive);

        if (index !== -1) {
            return true;
        }

        if (Object.is(primitive, this._polyline.primitive)) {
            return true;
        }

        return false;
    }
}
