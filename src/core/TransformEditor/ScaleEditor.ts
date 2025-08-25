/* qeslint-disable */
// q@ts-nocheck

import {
    Cartesian2,
    Cartesian3,
    defined,
    destroyObject,
    IntersectionTests,
    Matrix4,
    Plane,
    Ray,
    PointPrimitiveCollection,
    Scene,
    PointPrimitive,
    PrimitiveCollection
} from "cesium";

import getWidgetOrigin from "../getWidgetOrigin";
import { AxisLinePrimitive } from "../primitives";
import TransformAxis from "./TransformAxis";
import getScreenSpaceScalingMatrix from "../getScreenSpaceScalingMatrix";

const widgetOriginScratch = new Cartesian3();
const originScratch = new Cartesian3();
const directionScratch = new Cartesian3();
const planeNormalScratch = new Cartesian3();
const pickedPointScratch = new Cartesian3();
const moveScratch = new Cartesian3();
const offsetScratch = new Cartesian3();
const rayScratch = new Ray();
const noScale = new Cartesian3(1.0, 1.0, 1.0);
let nonUniformScalingScratch = new Cartesian3();
const defaultPixelSize = 100;
const defaultMaximumMeterSize = 1 / 0;

function getPoint(axis: string) {
    return {
        position: TransformAxis.getValue(axis),
        show: false,
        color: TransformAxis.getColor(axis),
        pixelSize: 20,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        id: axis
    };
}

function getLinePrimitive(axis: string) {
    return new AxisLinePrimitive({
        positions: [Cartesian3.ZERO, TransformAxis.getValue(axis)],
        color: TransformAxis.getColor(axis),
        id: axis,
        show: false
    });
}

type ConstructorOptions = {
    scene: Scene;
    primitiveCollection: PrimitiveCollection;
    transform: Matrix4;
    originOffset: Cartesian3;
    enableNonUniformScaling: any;
    setPosition: (value: Cartesian3) => void;
    setScale: (value: Cartesian3) => void;
    radius: number;
    pixelSize?: number;
    maximumSizeInMeters?: number;
};

class ScaleEditor {
    private _scene: Scene;
    private _canvas: HTMLCanvasElement;

    private _enableNonUniformScaling: any; //  KnockoutObservable<Boolean>
    private _setPositionCallback: (pos: Cartesian3) => void;
    private _setScaleCallback: (scale: Cartesian3) => void;

    originOffset: Cartesian3;

    private _points: PointPrimitiveCollection;
    private _pointX: PointPrimitive;
    private _pointY: PointPrimitive;
    private _pointZ: PointPrimitive;

    private _polylineX: AxisLinePrimitive;
    private _polylineY: AxisLinePrimitive;
    private _polylineZ: AxisLinePrimitive;

    private _modelMatrix: Matrix4;
    private _pickedAxis: string | undefined;
    private _dragAlongVector: Cartesian3 | undefined;
    private _offsetVector: Cartesian3;
    private _pickingPlane: Plane;

    private _dragging: boolean;
    private _startPosition: Cartesian3;
    private _startScale: Cartesian3;
    private _startOffset: Cartesian3;
    private _startTransform: Matrix4;
    private _active: boolean;

    private _transform: Matrix4;
    private _lineLength: number;
    private _pixelSize: Cartesian2;
    private _maximumSizeInMeters: Cartesian2;

    private _startValue = 0;

    constructor(options: ConstructorOptions) {
        const scene = options.scene;
        const transform = options.transform;

        const primitiveCollection = options.primitiveCollection;

        const points = primitiveCollection.add(new PointPrimitiveCollection());

        this.originOffset = options.originOffset;

        this._points = points;
        this._pointX = points.add(getPoint(TransformAxis.X));
        this._pointY = points.add(getPoint(TransformAxis.Y));
        this._pointZ = points.add(getPoint(TransformAxis.Z));

        this._polylineX = primitiveCollection.add(getLinePrimitive(TransformAxis.X));
        this._polylineY = primitiveCollection.add(getLinePrimitive(TransformAxis.Y));
        this._polylineZ = primitiveCollection.add(getLinePrimitive(TransformAxis.Z));

        this._scene = scene;
        this._canvas = scene.canvas;
        this._enableNonUniformScaling = options.enableNonUniformScaling;
        this._setPositionCallback = options.setPosition;
        this._setScaleCallback = options.setScale;
        this._modelMatrix = new Matrix4();

        this._pickedAxis = undefined;
        this._dragAlongVector = undefined;
        this._offsetVector = new Cartesian3();
        this._pickingPlane = new Plane(Cartesian3.UNIT_X, 0.0);
        this._dragging = false;
        this._startPosition = new Cartesian3();
        this._startScale = new Cartesian3();
        this._startOffset = new Cartesian3();
        this._startTransform = new Matrix4();
        this._active = false;

        this._transform = transform;
        this._lineLength = options.radius * 1.5;
        this._pixelSize = defined(options.pixelSize)
            ? new Cartesian2(options.pixelSize, options.pixelSize)
            : new Cartesian2(defaultPixelSize, defaultPixelSize);
        this._maximumSizeInMeters = defined(options.maximumSizeInMeters)
            ? new Cartesian2(options.maximumSizeInMeters, options.maximumSizeInMeters)
            : new Cartesian2(defaultMaximumMeterSize, defaultMaximumMeterSize);

        this.update();
    }

    get active() {
        return this._active;
    }

    set active(active) {
        this._active = active;
        if (active) {
            this._pointX.show = true;
            this._pointY.show = true;
            this._pointZ.show = true;
            this._polylineX.show = true;
            this._polylineY.show = true;
            this._polylineZ.show = true;
        } else {
            this._pointX.show = false;
            this._pointY.show = false;
            this._pointZ.show = false;
            this._polylineX.show = false;
            this._polylineY.show = false;
            this._polylineZ.show = false;
            this._dragging = false;
        }
    }

    get pixelSize() {
        return this._pixelSize.x;
    }

    get maximumSizeInMeters() {
        return this._maximumSizeInMeters.x;
    }

    handleLeftDown(position: Cartesian2) {
        const scene = this._scene;
        const transform = this._transform;
        const camera = scene.camera;

        const pickedObjects = scene.drillPick(position);
        const origin = Matrix4.getTranslation(transform, originScratch);

        let pickedAxis;
        for (let i = 0; i < pickedObjects.length; i++) {
            const object = pickedObjects[i];
            // @ts-ignore
            if (defined(object.id) && defined(TransformAxis[object.id])) {
                pickedAxis = object.id;
                break;
            }
        }
        if (!defined(pickedAxis)) {
            return;
        }
        const dragAlongVector = TransformAxis.getValue(pickedAxis);
        const directionVector = Matrix4.multiplyByPointAsVector(this._modelMatrix, dragAlongVector, directionScratch);

        let planeNormal = planeNormalScratch;
        if (Math.abs(Cartesian3.dot(camera.upWC, directionVector)) > 0.7) {
            // if up and the direction are close to parallel, the dot product will be close to 1
            planeNormal = Cartesian3.cross(camera.rightWC, directionVector, planeNormal);
        } else {
            planeNormal = Cartesian3.cross(camera.upWC, directionVector, planeNormal);
        }
        Cartesian3.normalize(planeNormal, planeNormal);
        const pickingPlane = Plane.fromPointNormal(origin, planeNormal, this._pickingPlane);
        const startPosition = IntersectionTests.rayPlane(
            camera.getPickRay(position, rayScratch)!,
            pickingPlane,
            this._startPosition
        );
        if (!defined(startPosition)) {
            return;
        }
        this._offsetVector = Cartesian3.subtract(startPosition, origin, this._offsetVector);
        this._dragging = true;

        const startScale = Matrix4.getScale(transform, this._startScale);
        let startValue;
        if (pickedAxis === TransformAxis.X) {
            startValue = startScale.x;
        } else if (pickedAxis === TransformAxis.Y) {
            startValue = startScale.y;
        } else {
            startValue = startScale.z;
        }
        this._startValue = startValue;
        this._startOffset = Cartesian3.multiplyComponents(this.originOffset, startScale, this._startOffset);
        this._dragAlongVector = dragAlongVector;
        this._pickedAxis = pickedAxis;
        this._startTransform = Matrix4.setScale(transform, noScale, this._startTransform);
        scene.screenSpaceCameraController.enableInputs = false;
    }

    handleMouseMove(position: Cartesian2) {
        if (!this._dragging) {
            return;
        }
        const scene = this._scene;
        const camera = scene.camera;

        const pickedPoint = IntersectionTests.rayPlane(
            camera.getPickRay(position, rayScratch)!,
            this._pickingPlane,
            pickedPointScratch
        );
        if (!defined(pickedPoint)) {
            return;
        }

        const dragAlongVector = this._dragAlongVector;
        const directionVector = Matrix4.multiplyByPointAsVector(this._modelMatrix, dragAlongVector!, directionScratch);
        let scaleVector = Cartesian3.subtract(pickedPoint, this._startPosition, moveScratch);
        scaleVector = Cartesian3.projectVector(scaleVector, directionVector, scaleVector);
        let scale = Cartesian3.magnitude(scaleVector);
        if (Cartesian3.dot(scaleVector, this._offsetVector) < 0) {
            // mouse drag is backwards, so we want to scale down
            scale = -scale;
        }

        scale /= this._lineLength;

        scale += this._startValue;
        if (scale <= 0) {
            return;
        }

        const pickedAxis = this._pickedAxis;
        const startScale = this._startScale;
        if (!this._enableNonUniformScaling()) {
            startScale.x = scale;
            startScale.y = scale;
            startScale.z = scale;
        } else if (pickedAxis === TransformAxis.X) {
            startScale.x = scale;
        } else if (pickedAxis === TransformAxis.Y) {
            startScale.y = scale;
        } else {
            startScale.z = scale;
        }

        let newOffset = Cartesian3.multiplyComponents(this.originOffset, startScale, offsetScratch);
        newOffset = Cartesian3.subtract(this._startOffset, newOffset, newOffset);
        newOffset = Matrix4.multiplyByPoint(this._startTransform, newOffset, newOffset);

        this._setScaleCallback(startScale);
        this._setPositionCallback(newOffset!);
    }

    handleLeftUp() {
        this._dragging = false;
        this._scene.screenSpaceCameraController.enableInputs = true;
    }

    update() {
        let modelMatrix = this._modelMatrix;

        const transform = this._transform;
        const widgetOrigin = getWidgetOrigin(transform, this.originOffset, widgetOriginScratch);

        modelMatrix = Matrix4.multiplyByUniformScale(transform, this._lineLength, modelMatrix);
        modelMatrix = Matrix4.setTranslation(this._modelMatrix, widgetOrigin, modelMatrix);

        // eslint-disable-next-line yoda
        const flag = 0 < this._pixelSize.x;

        // eslint-disable-next-line no-unused-expressions
        flag &&
            (modelMatrix = getScreenSpaceScalingMatrix(
                this._pixelSize,
                this._maximumSizeInMeters,
                // @ts-ignore
                this._scene.frameState,
                modelMatrix,
                modelMatrix
                // eslint-disable-next-line no-sequences
            )),
            flag &&
                this._enableNonUniformScaling &&
                // eslint-disable-next-line no-cond-assign
                ((nonUniformScalingScratch = Matrix4.getScale(modelMatrix, nonUniformScalingScratch)).x >=
                nonUniformScalingScratch.y
                    ? ((nonUniformScalingScratch.y = nonUniformScalingScratch.x),
                      (nonUniformScalingScratch.z = nonUniformScalingScratch.x))
                    : nonUniformScalingScratch.y >= nonUniformScalingScratch.x &&
                      ((nonUniformScalingScratch.x = nonUniformScalingScratch.y),
                      (nonUniformScalingScratch.z = nonUniformScalingScratch.y)),
                (modelMatrix = Matrix4.setScale(modelMatrix, nonUniformScalingScratch, modelMatrix)));

        this._polylineX.modelMatrix = modelMatrix;
        this._polylineY.modelMatrix = modelMatrix;
        this._polylineZ.modelMatrix = modelMatrix;
        this._points.modelMatrix = modelMatrix;
    }

    // eslint-disable-next-line class-methods-use-this
    isDestroyed() {
        return false;
    }

    destroy() {
        this.active = false;
        const scene = this._scene;
        this._points.removeAll();
        scene.primitives.remove(this._polylineX);
        scene.primitives.remove(this._polylineY);
        scene.primitives.remove(this._polylineZ);
        scene.primitives.remove(this._points);
        destroyObject(this);
    }
}

export default ScaleEditor;
