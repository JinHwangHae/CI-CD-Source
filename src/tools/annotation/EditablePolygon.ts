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

import { PointOptions, PolylinePrimitive, PolygonPrimitive } from "../../core";
import { editingPointOptions } from "./EditCommon";

const cart3Scratch1 = new Cartesian3();

export class EditablePolygon {
    private readonly _billboardCollection: BillboardCollection;
    private readonly _pointPrimitiveCollection: PointPrimitiveCollection;
    private readonly _pointOptions: PointOptions;
    private readonly _points: PointPrimitive[];
    private readonly _polyline: PolylinePrimitive;
    private readonly _polygon: PolygonPrimitive;
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
        polygon: PolygonPrimitive;
    }) {
        this._billboardCollection = options.billboardCollection;
        this._pointPrimitiveCollection = options.pointPrimitiveCollection;
        this._pointOptions = options.pointOptions;

        this._points = options.points;
        this._polyline = options.polyline;
        this._polygon = options.polygon;

        this._originalPositions = [];
        this._polygon.positions.forEach((position) => {
            this._originalPositions.push(position.clone(new Cartesian3()));
        });
        this._originalColor = new Color();
        this._polygon.color.clone(this._originalColor);
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

    get polygonPrimitive() {
        return this._polygon;
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
        const positions: Cartesian3[] = [];

        this._points.forEach((point) => {
            positions.push(point.position);
        });

        for (let i = 0; i < positions.length; i++) {
            const firstPosition = positions[i];

            let lastPosition;

            if (i === positions.length - 1) {
                lastPosition = positions[0];
            } else {
                lastPosition = positions[i + 1];
            }

            const midPosition = Cartesian3.midpoint(firstPosition, lastPosition, new Cartesian3());

            const middleVertex = this._billboardCollection.add({
                ...this._middleVertexOptions,
                position: midPosition
            });

            this._middleVertices.push(middleVertex);
        }
    }

    restoreMainVertices() {
        const positions: Cartesian3[] = [];

        this._points.forEach((point) => {
            positions.push(point.position);
        });

        this._points.forEach((point) => {
            this._pointPrimitiveCollection.remove(point);
        });

        this._points.length = 0;

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

    updateMainVertex(index: number, position: Cartesian3) {
        if (index < 0 || index > this._polygon.positions.length - 1) {
            throw new DeveloperError("error");
        }

        this._points[index].position = position;

        this._polyline.updatePosition(index, position);
        this._polygon.updatePosition(index, position);

        const positions = this._points.map((point) => point.position);
        const positionCount = positions.length;

        let prevMiddleVertexPointPrimitive;
        let nextPosition;
        let prevPosition;

        if (index === 0) {
            prevPosition = positions[positionCount - 1];
            prevMiddleVertexPointPrimitive = this._middleVertices[positionCount - 1];
        } else {
            prevPosition = positions[index - 1];
            prevMiddleVertexPointPrimitive = this._middleVertices[index - 1];
        }

        if (index === positionCount - 1) {
            nextPosition = positions[0];
        } else {
            nextPosition = positions[index + 1];
        }

        this._middleVertices[index].position = Cartesian3.midpoint(position, nextPosition, cart3Scratch1);
        prevMiddleVertexPointPrimitive.position = Cartesian3.midpoint(position, prevPosition, cart3Scratch1);

        this._vertexChanged.raiseEvent();
    }

    insertMainVertex(indexOfMiddleVertex: number) {
        const positions = this._polygon.positions;
        const position = positions[indexOfMiddleVertex];

        let nextPosition;

        if (indexOfMiddleVertex === positions.length - 1) {
            nextPosition = positions[0].clone(new Cartesian3());
        } else {
            nextPosition = positions[indexOfMiddleVertex + 1].clone(new Cartesian3());
        }

        const middleVertex = this._middleVertices[indexOfMiddleVertex];

        const newMainVertex = this._pointPrimitiveCollection.add({
            ...this._pointOptions,
            ...editingPointOptions,
            show: true,
            position: middleVertex.position
        });

        this._points.splice(indexOfMiddleVertex + 1, 0, newMainVertex);

        this._billboardCollection.remove(middleVertex);

        const middleVertexPosition = middleVertex.position;

        this._polygon.insertPosition(indexOfMiddleVertex + 1, middleVertexPosition);

        // note that polygon and polyline share positions property
        this._polyline.forceUpdate();
        this._polygon.forceUpdate();

        const newMiddleVertex1 = this._billboardCollection.add({
            ...this._middleVertexOptions,
            position: Cartesian3.midpoint(position, middleVertexPosition, new Cartesian3())
        });

        const newMiddleVertex2 = this._billboardCollection.add({
            ...this._middleVertexOptions,
            position: Cartesian3.midpoint(middleVertexPosition, nextPosition, new Cartesian3())
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
        this._polygon.positions = positions;

        this._polygon.color = this._originalColor;

        this._vertexChanged.raiseEvent();
    }

    removeMainVertex(indexOfMainVertex: number) {
        this._polygon.removePositon(indexOfMainVertex);

        // note that polygon and polyline share positions property
        this._polyline.forceUpdate();
        this._polygon.forceUpdate();

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

        if (Object.is(primitive, this._polygon.primitive)) {
            return true;
        }

        return false;
    }

    showHideMiddleVertice(show: boolean) {
        this._middleVertices.forEach((billboard) => {
            billboard.show = show;
        });
    }

    updatePositions(positions: Cartesian3[]) {
        this._polygon.positions = positions;
        this._polyline.positions = positions;

        for (let i = 0; i < this._pointPrimitiveCollection.length; i++) {
            this._pointPrimitiveCollection.get(i).position = positions[i];
        }

        this._originalPositions.length = 0;
        positions.forEach((position) => {
            this._originalPositions.push(position.clone(new Cartesian3()));
        });
    }
}
