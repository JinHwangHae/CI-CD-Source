import {
    Cartesian2,
    Cartesian3,
    Cartographic,
    Ellipsoid,
    HorizontalOrigin,
    Label,
    Math as CesiumMath,
    PointPrimitive,
    Scene,
    SceneTransforms,
    Color
} from "cesium";

import { MeasureUnits, PolylinePrimitive } from "../../../core";

import { MeasurementType } from "./MeasurementType";
import { Measurement } from "./Measurement";
import { editingPointOptions } from "../EditCommon";

interface ConstructorOptions {
    id: string;
    measureUnits: MeasureUnits;
    startPoint: PointPrimitive;
    endPoint: PointPrimitive;
    polyline: PolylinePrimitive;
    xyPolyline: PolylinePrimitive;
    xyBox: PolylinePrimitive;
    label: Label;
    xLabel: Label;
    xAngleLabel: Label;
    yLabel: Label;
    yAngleLabel: Label;
}

const cart2Scratch1 = new Cartesian2();
const cart2Scratch2 = new Cartesian2();
const scratchCarto = new Cartographic();

const cart3Scratch1 = new Cartesian3();
const cart3Scratch2 = new Cartesian3();
const cart3Scratch3 = new Cartesian3();

const fractions = 3;

export class DistanceMeasurement extends Measurement {
    private readonly _startPoint: PointPrimitive;
    private readonly _endPoint: PointPrimitive;
    private readonly _polyline: PolylinePrimitive;
    private readonly _xyPolyline: PolylinePrimitive;
    private readonly _xyBox: PolylinePrimitive;
    private readonly _label: Label;
    private readonly _xLabel: Label;
    private readonly _xAngleLabel: Label;
    private readonly _yLabel: Label;
    private readonly _yAngleLabel: Label;

    private readonly _positions: Cartesian3[];
    private readonly _xyPolylinePositions: Cartesian3[];
    private readonly _xyBoxPositions: Cartesian3[];

    private readonly _xPixelOffset: Cartesian2;
    private readonly _yPixelOffset: Cartesian2;

    protected readonly _selectedUnits: MeasureUnits;
    protected readonly _selectedLocale?: Intl.LocalesArgument;

    private readonly _originalPointOptions: any;
    private readonly _originalStartPointPosition: Cartesian3 = new Cartesian3();
    private readonly _originalEndPointPosition: Cartesian3 = new Cartesian3();

    constructor(options: ConstructorOptions) {
        super({
            id: options.id,
            type: MeasurementType.Distance
        });

        this._selectedUnits = options.measureUnits;

        this._startPoint = options.startPoint;
        this._endPoint = options.endPoint;
        this._polyline = options.polyline;
        this._xyPolyline = options.xyPolyline;
        this._xyBox = options.xyBox;
        this._label = options.label;
        this._xLabel = options.xLabel;
        this._xAngleLabel = options.xAngleLabel;
        this._yLabel = options.yLabel;
        this._yAngleLabel = options.yAngleLabel;

        this._yPixelOffset = new Cartesian2(-9, 0);
        this._xPixelOffset = new Cartesian2(9, 0);

        this._positions = [new Cartesian3(), new Cartesian3()];
        this._xyPolylinePositions = [new Cartesian3(), new Cartesian3(), new Cartesian3()];
        this._xyBoxPositions = [new Cartesian3(), new Cartesian3(), new Cartesian3()];

        this._originalPointOptions = {
            color: Color.clone(this._startPoint.color),
            pixelSize: this._startPoint.pixelSize
        };
    }

    get startPoint() {
        return this._startPoint;
    }

    get endPoint() {
        return this._endPoint;
    }

    get polyline() {
        return this._polyline;
    }

    get xyPolyline() {
        return this._xyPolyline;
    }

    get xyBox() {
        return this._xyBox;
    }

    get label() {
        return this._label;
    }

    get xLabel() {
        return this._xLabel;
    }

    get xAngleLabel() {
        return this._xAngleLabel;
    }

    get yLabel() {
        return this._yLabel;
    }

    get yAngleLabel() {
        return this._yAngleLabel;
    }

    showHide(show: boolean): void {
        this._polyline.show = show;
        this._xyPolyline.show = show;
        this._xyBox.show = show;
        this._startPoint.show = show;
        this._endPoint.show = show;
        this._label.show = show;
        this._xLabel.show = show;
        this._yLabel.show = show;
        this._xAngleLabel.show = show;
        this._yAngleLabel.show = show;
    }

    getDetail(): Object {
        return {
            startPointPosition: this.startPoint.position,
            endPointPosition: this.endPoint.position
        };
    }

    startEditing() {
        let point = this._startPoint;

        this._startPoint.position.clone(this._originalStartPointPosition);
        this._endPoint.position.clone(this._originalEndPointPosition);

        point.color = editingPointOptions.color;
        point.pixelSize = editingPointOptions.pixelSize;
        point.outlineWidth = editingPointOptions.outlineWidth;
        point.outlineColor = editingPointOptions.outlineColor;

        point = this._endPoint;

        point.color = editingPointOptions.color;
        point.pixelSize = editingPointOptions.pixelSize;
        point.outlineWidth = editingPointOptions.outlineWidth;
        point.outlineColor = editingPointOptions.outlineColor;
    }

    restorePoints() {
        const color = this._originalPointOptions.color;
        const pixelSize = this._originalPointOptions.pixelSize;

        let point = this._startPoint;

        point.color = color;
        point.pixelSize = pixelSize;
        point.position = this._originalStartPointPosition;
        point.outlineWidth = 0;

        point = this._endPoint;

        point.color = color;
        point.pixelSize = pixelSize;
        point.position = this._originalEndPointPosition;
        point.outlineWidth = 0;
    }

    revertToOriginal(scene: Scene) {
        const color = this._originalPointOptions.color;
        const pixelSize = this._originalPointOptions.pixelSize;

        let point = this._startPoint;

        point.color = color;
        point.pixelSize = pixelSize;
        point.position = this._originalStartPointPosition;
        point.outlineWidth = 0;

        point = this._endPoint;

        point.color = color;
        point.pixelSize = pixelSize;
        point.position = this._originalEndPointPosition;
        point.outlineWidth = 0;

        this._polyline.positions = [this._originalStartPointPosition, this._originalEndPointPosition];
        this.updateComponents();
        this.updateLabelPosition(scene);
    }

    updateComponents() {
        const xLabel = this._xLabel;
        const yLabel = this._yLabel;
        const xAngleLabel = this._xAngleLabel;
        const yAngleLabel = this._yAngleLabel;
        const xyPolyline = this._xyPolyline;
        const xyBox = this._xyBox;

        // always set to false first in case we can't compute the values.
        xLabel.show = false;
        yLabel.show = false;
        xAngleLabel.show = false;
        yAngleLabel.show = false;
        xyPolyline.show = false;
        xyBox.show = false;

        const ellipsoid = Ellipsoid.WGS84;

        const positions = this._polyline.positions;
        const p0 = positions[0];
        const p1 = positions[1];
        const height0 = ellipsoid.cartesianToCartographic(p0, scratchCarto).height;
        const height1 = ellipsoid.cartesianToCartographic(p1, scratchCarto).height;
        let bottomPoint;
        let topPoint;
        let topHeight;
        let bottomHeight;

        if (height0 < height1) {
            bottomPoint = p0;
            topPoint = p1;
            topHeight = height1;
            bottomHeight = height0;
        } else {
            bottomPoint = p1;
            topPoint = p0;
            topHeight = height0;
            bottomHeight = height1;
        }

        const xyPositions = this._xyPolylinePositions;
        xyPositions[0] = Cartesian3.clone(bottomPoint, xyPositions[0]);
        xyPositions[2] = Cartesian3.clone(topPoint, xyPositions[2]);
        let normal = ellipsoid.geodeticSurfaceNormal(bottomPoint, cart3Scratch1);
        normal = Cartesian3.multiplyByScalar(normal, topHeight - bottomHeight, normal);
        const corner = Cartesian3.add(bottomPoint, normal, xyPositions[1]);

        xyPolyline.positions = xyPositions;

        if (
            Cartesian3.equalsEpsilon(corner, topPoint, CesiumMath.EPSILON10) ||
            Cartesian3.equalsEpsilon(corner, bottomPoint, CesiumMath.EPSILON10)
        ) {
            return;
        }

        yLabel.show = true;
        xLabel.show = true;
        yAngleLabel.show = true;
        xAngleLabel.show = true;
        xyPolyline.show = true;
        xyBox.show = true;

        let v1 = Cartesian3.subtract(topPoint, corner, cart3Scratch1);
        let v2 = Cartesian3.subtract(bottomPoint, corner, cart3Scratch2);
        const mag = Math.min(Cartesian3.magnitude(v1), Cartesian3.magnitude(v2));
        const scale = mag > 15.0 ? mag * 0.15 : mag * 0.25;
        v1 = Cartesian3.normalize(v1, v1);
        v2 = Cartesian3.normalize(v2, v2);
        v1 = Cartesian3.multiplyByScalar(v1, scale, v1);
        v2 = Cartesian3.multiplyByScalar(v2, scale, v2);

        const boxPos = this._xyBoxPositions;
        boxPos[0] = Cartesian3.add(corner, v1, boxPos[0]);
        boxPos[1] = Cartesian3.add(boxPos[0], v2, boxPos[1]);
        boxPos[2] = Cartesian3.add(corner, v2, boxPos[2]);
        xyBox.positions = boxPos;

        xLabel.position = Cartesian3.midpoint(corner, topPoint, cart3Scratch1);
        yLabel.position = Cartesian3.midpoint(bottomPoint, corner, cart3Scratch1);
        xAngleLabel.position = Cartesian3.clone(topPoint, cart3Scratch1);
        yAngleLabel.position = Cartesian3.clone(bottomPoint, cart3Scratch1);

        const vx = Cartesian3.subtract(corner, topPoint, cart3Scratch2);
        const vy = Cartesian3.subtract(corner, bottomPoint, cart3Scratch1);
        let v = Cartesian3.subtract(topPoint, bottomPoint, cart3Scratch3);

        const yAngle = Cartesian3.angleBetween(vy, v);
        v = Cartesian3.negate(v, v);
        const xAngle = Cartesian3.angleBetween(vx, v);

        const xDistance = Cartesian3.magnitude(vx);
        const yDistance = Cartesian3.magnitude(vy);

        const selectedUnits = this._selectedUnits;
        const selectedLocale = this._selectedLocale;
        xLabel.text = MeasureUnits.distanceToString(xDistance, selectedUnits.distanceUnits, selectedLocale, fractions);
        yLabel.text = MeasureUnits.distanceToString(yDistance, selectedUnits.distanceUnits, selectedLocale, fractions);

        xAngleLabel.text = MeasureUnits.angleToString(xAngle, selectedUnits.slopeUnits, selectedLocale, fractions);
        yAngleLabel.text = MeasureUnits.angleToString(yAngle, selectedUnits.slopeUnits, selectedLocale, fractions);

        const pos0 = positions[0];
        const pos1 = positions[1];

        const vec = Cartesian3.subtract(pos1, pos0, cart3Scratch1);
        const distance = Cartesian3.magnitude(vec);

        const label = this._label;
        label.position = Cartesian3.midpoint(pos0, pos1, cart3Scratch1);
        label.text = MeasureUnits.distanceToString(
            distance,
            this._selectedUnits.distanceUnits,
            this._selectedLocale,
            fractions
        );
        label.show = true;

        this.updated.raiseEvent();
    }

    updateLabelPosition(scene: Scene) {
        const positions = this._positions;

        const p0 = positions[0];
        const p1 = positions[1];

        const pos0 = SceneTransforms.wgs84ToWindowCoordinates(scene, p0, cart2Scratch1);
        const pos1 = SceneTransforms.wgs84ToWindowCoordinates(scene, p1, cart2Scratch2);

        if (!pos0 || !pos1) {
            return;
        }

        const label = this._label;
        const yLabel = this._yLabel;
        const xAngleLabel = this._xAngleLabel;
        const m = (pos0.y - pos1.y) / (pos1.x - pos0.x);

        if (m > 0) {
            this._yPixelOffset.x = -9;
            this._xPixelOffset.x = 12;
            yLabel.pixelOffset = this._yPixelOffset;
            yLabel.horizontalOrigin = HorizontalOrigin.RIGHT;
            xAngleLabel.pixelOffset = this._xPixelOffset;
            xAngleLabel.horizontalOrigin = HorizontalOrigin.LEFT;
            label.horizontalOrigin = HorizontalOrigin.LEFT;
        } else {
            this._yPixelOffset.x = 9;
            this._xPixelOffset.x = -12;
            yLabel.pixelOffset = this._yPixelOffset;
            yLabel.horizontalOrigin = HorizontalOrigin.LEFT;
            xAngleLabel.pixelOffset = this._xPixelOffset;
            xAngleLabel.horizontalOrigin = HorizontalOrigin.RIGHT;
            label.horizontalOrigin = HorizontalOrigin.RIGHT;
        }
    }

    reset() {
        this._polyline.show = false;
        this._xyPolyline.show = false;
        this._xyBox.show = false;
        this._label.show = false;
        this._xLabel.show = false;
        this._yLabel.show = false;
        this._xAngleLabel.show = false;
        this._yAngleLabel.show = false;
        this._startPoint.show = false;
        this._endPoint.show = false;
    }

    updateByPoint(scene: Scene, point: PointPrimitive) {
        const positions = this._polyline.positions;
        const position = point.position;

        if (Object.is(this._startPoint, point)) {
            position.clone(positions[0]);

            this._polyline.positions = positions;
        } else if (Object.is(this._endPoint, point)) {
            position.clone(positions[1]);
            this._polyline.positions = positions;
        }

        this.updateComponents();
        this.updateLabelPosition(scene);
    }

    isContain(primitive: any): boolean {
        if (Object.is(primitive, this._startPoint)) {
            return true;
        }

        if (Object.is(primitive, this._endPoint)) {
            return true;
        }

        if (Object.is(primitive, this._polyline.primitive)) {
            return true;
        }

        if (Object.is(primitive, this._xyPolyline.primitive)) {
            return true;
        }

        if (Object.is(primitive, this._xyBox.primitive)) {
            return true;
        }

        if (Object.is(primitive, this._label)) {
            return true;
        }

        if (Object.is(primitive, this._xLabel)) {
            return true;
        }

        if (Object.is(primitive, this._xAngleLabel)) {
            return true;
        }

        if (Object.is(primitive, this._yLabel)) {
            return true;
        }

        if (Object.is(primitive, this._yAngleLabel)) {
            return true;
        }

        return false;
    }

    measurementString(): string {
        const ellipsoid = Ellipsoid.WGS84;

        const positions = this._polyline.positions;

        const p0 = positions[0];
        const p1 = positions[1];
        const height0 = ellipsoid.cartesianToCartographic(p0, scratchCarto).height;
        const height1 = ellipsoid.cartesianToCartographic(p1, scratchCarto).height;
        let bottomPoint;
        let topPoint;
        let topHeight;
        let bottomHeight;

        if (height0 < height1) {
            bottomPoint = p0;
            topPoint = p1;
            topHeight = height1;
            bottomHeight = height0;
        } else {
            bottomPoint = p1;
            topPoint = p0;
            topHeight = height0;
            bottomHeight = height1;
        }

        const xyPositions = this._xyPolylinePositions;
        xyPositions[0] = Cartesian3.clone(bottomPoint, xyPositions[0]);
        xyPositions[2] = Cartesian3.clone(topPoint, xyPositions[2]);
        let normal = ellipsoid.geodeticSurfaceNormal(bottomPoint, cart3Scratch1);
        normal = Cartesian3.multiplyByScalar(normal, topHeight - bottomHeight, normal);
        const corner = Cartesian3.add(bottomPoint, normal, xyPositions[1]);

        if (
            Cartesian3.equalsEpsilon(corner, topPoint, CesiumMath.EPSILON10) ||
            Cartesian3.equalsEpsilon(corner, bottomPoint, CesiumMath.EPSILON10)
        ) {
            return "";
        }

        const vx = Cartesian3.subtract(corner, topPoint, cart3Scratch2);
        const vy = Cartesian3.subtract(corner, bottomPoint, cart3Scratch1);

        const xDistance = Cartesian3.magnitude(vx);
        const yDistance = Cartesian3.magnitude(vy);

        const selectedLocale = this._selectedLocale;

        const pos0 = positions[0];
        const pos1 = positions[1];

        const vec = Cartesian3.subtract(pos1, pos0, cart3Scratch1);
        const distance = Cartesian3.magnitude(vec);

        let ret = "";

        ret += `Vertical Distance: ${MeasureUnits.distanceToString(
            yDistance,
            this._selectedUnits.distanceUnits,
            selectedLocale,
            fractions
        )}\n`;

        ret += `Horizonatal Distance: ${MeasureUnits.distanceToString(
            xDistance,
            this._selectedUnits.distanceUnits,
            selectedLocale,
            fractions
        )}\n`;

        ret += `Diagonal Distance: ${MeasureUnits.distanceToString(
            distance,
            this._selectedUnits.distanceUnits,
            selectedLocale,
            fractions
        )}\n`;

        return ret;
    }
}
