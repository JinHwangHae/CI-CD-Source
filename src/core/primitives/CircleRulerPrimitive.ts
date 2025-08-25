import {
    Cartesian3,
    Color,
    defaultValue,
    defined,
    destroyObject,
    Ellipsoid,
    HeadingPitchRoll,
    Matrix4,
    Math as CesiumMath,
    // @ts-ignore
    FrameState,
    Primitive,
    Transforms
} from "cesium";

import { createPolylinePrimitive } from "./createPolylinePrimitive";
import { createCoplanarPolygonPrimitive } from "./createCoplanarPolygonPrimitive";

const rotationComponentType = "rotation";
const rotationCircleComponentIndex = "rotation-circle";

const TWO_PI = 2 * Math.PI;

const defaultColor = new Color(55 / 255, 137 / 255, 242 / 255);

const hprScratch = new HeadingPitchRoll();
const originScratch = new Cartesian3();

export enum Axes {
    x = "X",
    y = "Y",
    z = "Z"
}

function createUnitCirclePositions(options: { axis: Axes; pointsCount: number }) {
    const points = [];

    const angleStep = TWO_PI / options.pointsCount;

    for (let i = 0; i < options.pointsCount; i += 1) {
        const angle = i * angleStep;
        const x = Math.cos(angle);
        const y = Math.sin(angle);

        if (options.axis === Axes.x) {
            points.push(new Cartesian3(0, x, y));
        } else if (options.axis === Axes.y) {
            points.push(new Cartesian3(y, 0, x));
        } else {
            points.push(new Cartesian3(x, y, 0));
            // zaxis
        }
    }

    return points;
}

interface ConstructorOptions {
    axis: Axes;
    show?: boolean;
    entityId: string;
    angle: number; // in radians
    height: number;
    radius: number;
    showDegrees?: boolean;
    showAngle?: boolean;
    color?: Color;
    modelMatrix: Matrix4;
}

function toStringFromPrefix(options: { prefix: string; componentType: string; componentIndex?: number | string }) {
    return defined(options.componentIndex)
        ? `${options.prefix}:${options.componentType}:${options.componentIndex}`
        : `${options.prefix}:${options.componentType}`;
}

export class CircleRulerPrimitive {
    private _axis: Axes;
    private _showDegrees;
    private _shownAngle;
    private _shouldRedraw;
    private _smallLines: Primitive[];
    private _largeLines: Primitive[];
    private _highlightRotate;
    private _angle;
    private readonly _height;
    private _radius;
    private readonly _color;
    private _modelMatrix;
    private _invModelMatrix;
    private _show: boolean;
    private _unitCirclePositions: Cartesian3[];
    private _rotationStartAngle: number = 0;

    entityId: string;
    circlePrimitive: Primitive | undefined;
    circleOutline: Primitive | undefined;
    degreesArcPrimitive: Primitive | undefined;

    constructor(options: ConstructorOptions) {
        this._axis = options.axis;
        this._show = defaultValue(options.show, true);
        this._showDegrees = defaultValue(options.showDegrees, false);
        this._shownAngle = defaultValue(options.showAngle, false);
        this._shouldRedraw = true;
        this._smallLines = [];
        this._largeLines = [];
        this._highlightRotate = false;

        console.assert(options.radius > 0, "options.radius > 0");

        this.entityId = options.entityId;
        this._angle = options.angle;
        this._height = options.height;
        this._radius = options.radius;
        this._color = defaultValue(options.color, defaultColor);
        this._modelMatrix = options.modelMatrix;
        this._invModelMatrix = Matrix4.inverse(this._modelMatrix, new Matrix4());

        this._unitCirclePositions = createUnitCirclePositions({ pointsCount: 72, axis: this._axis });
    }

    destroy() {
        this.circlePrimitive?.destroy();
        this.circlePrimitive = undefined;
        this.circleOutline?.destroy();
        this.circleOutline = undefined;
        this.degreesArcPrimitive?.destroy();
        this.degreesArcPrimitive = undefined;

        this._largeLines.forEach((line) => {
            line.destroy();
        });

        this._largeLines = [];

        this._smallLines.forEach((line) => {
            line.destroy();
        });

        this._smallLines = [];

        return destroyObject(this);
    }

    // eslint-disable-next-line class-methods-use-this
    isDestroyed() {
        return false;
    }

    get modelMatrix() {
        return this._modelMatrix;
    }

    set modelMatrix(matrix: Matrix4) {
        const hpr = Transforms.fixedFrameToHeadingPitchRoll(matrix, Ellipsoid.WGS84, undefined, hprScratch);
        const origin = Matrix4.getTranslation(matrix, originScratch);

        if (this._axis === Axes.x) {
            //    hpr.roll = 0;
        }

        if (this._axis === Axes.y) {
            //  hpr.pitch = 0;
        }

        if (this._axis === Axes.z) {
            // hpr.heading = 0;
        }

        this._modelMatrix = Transforms.headingPitchRollToFixedFrame(
            origin,
            hpr,
            Ellipsoid.WGS84,
            Transforms.eastNorthUpToFixedFrame,
            new Matrix4()
        );
        this._invModelMatrix = Matrix4.inverse(this._modelMatrix, new Matrix4());
        this._shouldRedraw = true;
    }

    get invModelMatrix() {
        return this._invModelMatrix;
    }

    get angle() {
        return this._angle;
    }

    set angle(t) {
        if (this._angle !== t) {
            this._angle = t;
            this._shouldRedraw = true;
        }
    }

    get height() {
        return this._height;
    }

    get radius() {
        return this._radius;
    }

    set radius(t) {
        if (this._radius !== t) {
            this._radius = t;
            this._shouldRedraw = true;
        }
    }

    get showAngle() {
        return this._shownAngle;
    }

    set showAngle(t) {
        if (this._shownAngle !== t) {
            this._shownAngle = t;
            this._shouldRedraw = true;
        }
    }

    get showDegrees() {
        return this._showDegrees;
    }

    set showDegrees(t) {
        if (t !== this._showDegrees) {
            this._showDegrees = t;
            this._shouldRedraw = true;
        }
    }

    get highlightRotate() {
        return this._highlightRotate;
    }

    set highlightRotate(t) {
        if (this._highlightRotate !== t) {
            this._highlightRotate = t;
            this._shouldRedraw = true;
        }
    }

    get show() {
        return this._show;
    }

    set show(val: boolean) {
        this._show = val;
    }

    get rotationStartAngle() {
        return this._rotationStartAngle;
    }

    set rotationStartAngle(val: number) {
        this._rotationStartAngle = val;
    }

    determineRotationStartAngle(position: Cartesian3) {
        const local = Matrix4.multiplyByPoint(this._invModelMatrix, position, new Cartesian3());

        let angle = 0;

        if (this._axis === Axes.x) {
            angle = Math.atan2(local.z, local.y);
        }

        if (this._axis === Axes.y) {
            angle = Math.atan2(local.x, local.z);
        }

        if (this._axis === Axes.z) {
            angle = Math.atan2(local.y, local.x);
        }

        if (angle < 0) {
            // make sure that angle drops between 0 and 2 PI.
            angle = Math.PI * 2 + angle;
        }

        this._rotationStartAngle = angle;
        this._angle = 0;
    }

    update(frameState: FrameState) {
        if (!this._show) {
            return;
        }

        if (this._shouldRedraw) {
            this.destroy();

            const unitCirclePoints = this._unitCirclePositions;

            this._createCircle(unitCirclePoints);

            if (this._shownAngle && Math.abs(this._angle) > 0) {
                const i = this._createArcPoints();
                this._createArc(i);
            }

            if (this._showDegrees && this._smallLines.length === 0) {
                this._createSmallLines(unitCirclePoints);
                this._createLargeLines(unitCirclePoints);
            }

            this._shouldRedraw = false;
        }

        // @ts-ignore
        this.circlePrimitive?.update(frameState);
        // @ts-ignore
        this.circleOutline?.update(frameState);
        // @ts-ignore
        this.degreesArcPrimitive?.update(frameState);

        this._smallLines.forEach((line) => {
            // @ts-ignore
            line.update(frameState);
        });

        this._largeLines.forEach((line) => {
            // @ts-ignore
            line.update(frameState);
        });
    }

    _createCircle(unitCirclePoints: Cartesian3[]) {
        const n = this._adjustPoints(unitCirclePoints, this._height, this._radius);
        const i = this._adjustPoints(unitCirclePoints, this._height, 0.95 * this._radius);

        const points = [...n, n[0], ...i.reverse(), i[0]];

        const id = toStringFromPrefix({
            prefix: this.entityId,
            componentType: rotationComponentType,
            componentIndex: rotationCircleComponentIndex
        });

        const color = this._color.withAlpha(this._highlightRotate ? 0.6 : 0.4);

        this.circlePrimitive = createCoplanarPolygonPrimitive({
            id: id,
            modelMatrix: this._modelMatrix,
            color: color,
            points: points,
            selectable: true,
            shadows: false
        });

        this.circleOutline = createPolylinePrimitive({
            id: `${id}-outline`,
            modelMatrix: this._modelMatrix,
            width: 1,
            color: this._color.withAlpha(0),
            alwaysOnTop: true,
            positions: n
        });
    }

    // eslint-disable-next-line class-methods-use-this
    _adjustPoints(points: Cartesian3[], height: number, radius: number) {
        const ret = [];

        for (let i = 0; i < points.length; i += 1) {
            ret[i] = Cartesian3.multiplyByScalar(points[i], radius, new Cartesian3());

            if (this._axis === Axes.x) {
                ret[i].x = height;
            } else if (this._axis === Axes.y) {
                ret[i].y = height;
            } else {
                ret[i].z = height;
            }
        }

        return ret;
    }

    _createArcPoints() {
        const angle = CesiumMath.toDegrees(Math.abs(this._angle));
        const pointCount = Math.ceil(angle / 5) + 1;

        const self = this;

        const arcPoints = (function (options) {
            const ret = [];
            const angleStep = (options.endAngle - options.startAngle) / (options.pointsCount - 1);
            const z = options.height ?? 0;

            for (let i = 0; i < options.pointsCount; i += 1) {
                const curAngle = options.startAngle + i * angleStep;

                const x = Math.cos(curAngle) * options.radius;
                const y = Math.sin(curAngle) * options.radius;

                if (self._axis === Axes.x) {
                    ret.push(new Cartesian3(z, x, y));
                } else if (self._axis === Axes.y) {
                    ret.push(new Cartesian3(y, z, x));
                } else {
                    ret.push(new Cartesian3(x, y, z));
                }
            }

            return ret;
        })({
            startAngle: self._rotationStartAngle,
            endAngle: self._rotationStartAngle + this._angle,
            pointsCount: pointCount,
            radius: this._radius,
            height: this._height
        });

        /*
        console.info(
            "start angle: ",
            CesiumMath.toDegrees(this._rotationStartAngle),
            " end angle: ",
            CesiumMath.toDegrees(this._rotationStartAngle + this._angle)
        );
        */

        if (self._axis === Axes.x) {
            arcPoints.push(new Cartesian3(this._height, 0, 0));
        } else if (self._axis === Axes.y) {
            arcPoints.push(new Cartesian3(0, this._height, 0));
        } else {
            arcPoints.push(new Cartesian3(0, 0, this._height));
        }

        return arcPoints;
    }

    _createArc(points: Cartesian3[]) {
        const id = toStringFromPrefix({
            prefix: this.entityId,
            componentType: rotationComponentType,
            componentIndex: "angle"
        });

        this.degreesArcPrimitive = createCoplanarPolygonPrimitive({
            id: id,
            modelMatrix: this._modelMatrix,
            color: Color.ORANGE.withAlpha(0.3),
            points: points,
            shadows: false
        });
    }

    _createSmallLines(unitCirclePoints: Cartesian3[]) {
        let startPoint = new Cartesian3();
        let endPoint = new Cartesian3();

        for (let i = 0; i < unitCirclePoints.length; i += 1)
            if (i % 9 !== 0) {
                const point = unitCirclePoints[i];

                startPoint = point.clone(startPoint);
                startPoint = Cartesian3.multiplyByScalar(startPoint, this._radius, startPoint);

                if (this._axis === Axes.x) {
                    startPoint.x = this._height;
                } else if (this._axis === Axes.y) {
                    startPoint.y = this._height;
                } else {
                    startPoint.z = this._height;
                }

                endPoint = point.clone(endPoint);
                endPoint = Cartesian3.multiplyByScalar(endPoint, 1.05 * this._radius, endPoint);

                if (this._axis === Axes.x) {
                    endPoint.x = this._height;
                } else if (this._axis === Axes.y) {
                    endPoint.y = this._height;
                } else {
                    endPoint.z = this._height;
                }

                const smallLine = createPolylinePrimitive({
                    id: toStringFromPrefix({
                        prefix: this.entityId,
                        componentType: `${rotationComponentType}-small-line`,
                        componentIndex: i
                    }),
                    positions: [startPoint, endPoint],
                    width: 1,
                    color: Color.BLACK,
                    modelMatrix: this._modelMatrix,
                    alwaysOnTop: true
                });

                this._smallLines.push(smallLine);
            }
    }

    _createLargeLines(unitCirclePoints: Cartesian3[]) {
        let startPoint = new Cartesian3();
        let endPoint = new Cartesian3();

        for (let i = 0; i < unitCirclePoints.length; i += 9) {
            const point = unitCirclePoints[i];

            startPoint = point.clone(startPoint);
            startPoint = Cartesian3.multiplyByScalar(startPoint, 0.95 * this._radius, startPoint);
            if (this._axis === Axes.x) {
                startPoint.x = this._height;
            } else if (this._axis === Axes.y) {
                startPoint.y = this._height;
            } else {
                startPoint.z = this._height;
            }

            endPoint = point.clone(endPoint);
            endPoint = Cartesian3.multiplyByScalar(endPoint, 1.1 * this._radius, endPoint);
            if (this._axis === Axes.x) {
                endPoint.x = this._height;
            } else if (this._axis === Axes.y) {
                endPoint.y = this._height;
            } else {
                endPoint.z = this._height;
            }

            const largeLine = createPolylinePrimitive({
                id: toStringFromPrefix({
                    prefix: this.entityId,
                    componentType: `${rotationComponentType}-large-line`,
                    componentIndex: i
                }),
                positions: [startPoint, endPoint],
                width: 3,
                color: Color.BLACK,
                modelMatrix: this._modelMatrix,
                alwaysOnTop: true
            });

            this._largeLines.push(largeLine);
        }
    }
}
