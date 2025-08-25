import {
    Cartesian2,
    Cartesian3,
    Color,
    defaultValue,
    defined,
    destroyObject,
    // @ts-ignore
    FrameState,
    Ellipsoid,
    Math as CesiumMath,
    Matrix4,
    HeadingPitchRoll,
    Transforms
} from "cesium";

import getScreenSpaceScalingMatrix from "../getScreenSpaceScalingMatrix";
import { getUnitZCirclePositions } from "../getUnitZCirclePositions";
import { PolylinePrimitive } from "./PolylinePrimitive";
import { PolygonPrimitive } from "./PolygonPrimitive";

interface ConstructorOptions {
    show?: boolean;
    position?: Cartesian3;
    heading?: number;
    pitch?: number;
    allowPicking?: boolean;
}

const circlePixelSize = new Cartesian2(20, 20);
const dotPixelSize = new Cartesian2(10, 10);
const maximumSizeInMeters = new Cartesian2(1 / 0, 1 / 0);
const scratchModelMatrix = new Matrix4();
const scratchScaledModelMatrix = new Matrix4();

export class DotCirclePrimitive {
    private readonly _polylinePrimmitve: PolylinePrimitive;
    private readonly _polygonPrimitive: PolygonPrimitive;
    private _show: boolean;
    private _modelMatrix: Matrix4;
    private readonly _position: Cartesian3 = new Cartesian3();

    constructor(options: ConstructorOptions) {
        this._show = defaultValue(options.show, true);

        const allowPicking = defaultValue(options.allowPicking, true);

        this._polylinePrimmitve = new PolylinePrimitive({
            positions: getUnitZCirclePositions(10),
            color: Color.WHITE,
            width: 2,
            loop: true,
            show: true,
            allowPicking: allowPicking
        });

        this._polygonPrimitive = new PolygonPrimitive({
            positions: getUnitZCirclePositions(10),
            color: Color.WHITE,
            show: true,
            allowPicking: allowPicking
        });

        this._modelMatrix = Matrix4.clone(Matrix4.IDENTITY);

        if (options.position && defined(options.heading) && defined(options.pitch)) {
            this.setModelMatrix(options.position, options.heading!, options.pitch!);
        }
    }

    get boundingVolume() {
        return this._polylinePrimmitve.boundingVolume;
    }

    get position() {
        return this._position;
    }

    get headingPitchRoll() {
        const hpr = new HeadingPitchRoll();

        Transforms.fixedFrameToHeadingPitchRoll(
            this._modelMatrix,
            Ellipsoid.WGS84,
            Transforms.eastNorthUpToFixedFrame,
            hpr
        );

        return hpr;
    }

    get show() {
        return this._show;
    }

    set show(show) {
        this._show = show;

        this._polygonPrimitive.show = show;
        this._polylinePrimmitve.show = show;
    }

    get modelMatrix() {
        return this._modelMatrix;
    }

    set modelMatrix(modelMatrix) {
        if (Matrix4.equalsEpsilon(modelMatrix, this._modelMatrix, CesiumMath.EPSILON10)) {
            return;
        }

        Matrix4.clone(modelMatrix, this._modelMatrix);
        Cartesian3.clone(Matrix4.getTranslation(modelMatrix, new Cartesian3()), this._position);
    }

    get polygonPrimitive() {
        return this._polygonPrimitive;
    }

    setModelMatrix(position: Cartesian3, heading: number, pitch: number) {
        const hpr = new HeadingPitchRoll(heading, pitch, 0);
        const modelMatrix = Transforms.headingPitchRollToFixedFrame(
            position,
            hpr,
            Ellipsoid.WGS84,
            Transforms.eastNorthUpToFixedFrame,
            scratchModelMatrix
        );

        if (Matrix4.equalsEpsilon(modelMatrix, this._modelMatrix, CesiumMath.EPSILON10)) {
            return;
        }

        Matrix4.clone(modelMatrix, this._modelMatrix);
        Cartesian3.clone(position, this._position);
    }

    update(frameState: FrameState) {
        if (!this._show) {
            return;
        }

        let modelMatrix = this._modelMatrix.clone(scratchScaledModelMatrix);

        getScreenSpaceScalingMatrix(circlePixelSize, maximumSizeInMeters, frameState, modelMatrix, modelMatrix);

        this._polylinePrimmitve.modelMatrix = modelMatrix;
        this._polylinePrimmitve.update(frameState);

        modelMatrix = this._modelMatrix.clone(scratchScaledModelMatrix);

        getScreenSpaceScalingMatrix(dotPixelSize, maximumSizeInMeters, frameState, modelMatrix, modelMatrix);

        this._polygonPrimitive.modelMatrix = modelMatrix;
        this._polygonPrimitive.update(frameState);
    }

    destroy() {
        this._polygonPrimitive.destroy();
        this._polylinePrimmitve.destroy();

        return destroyObject(this);
    }

    isContain(primitive: any): boolean {
        if (Object.is(primitive, this._polylinePrimmitve.primitive)) {
            return true;
        }

        if (Object.is(primitive, this._polygonPrimitive.primitive)) {
            return true;
        }

        return false;
    }
}
