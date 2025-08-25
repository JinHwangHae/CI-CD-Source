/* qeslint-disable */
// q@ts-nocheck

import {
    Cartesian3,
    Cartesian2,
    defined,
    destroyObject,
    HeadingPitchRoll,
    IntersectionTests,
    Matrix4,
    Plane,
    PrimitiveCollection,
    Ray,
    Scene,
    Transforms
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
const offsetProjectedScratch = new Cartesian3();
const rayScratch = new Ray();
const defaultPixelSize = 100;
const defaultMaximumMeterSize = 1 / 0;

function getLinePrimitive(axis: string) {
    return new AxisLinePrimitive({
        positions: [Cartesian3.ZERO, TransformAxis.getValue(axis)],
        arrow: true,
        color: TransformAxis.getColor(axis),
        id: axis,
        show: false
    });
}

type ConstructorOptions = {
    ignorePitchRoll?: boolean;
    scene: Scene;
    originOffset: Cartesian3;
    setPosition: (value: Cartesian3) => void;
    primitiveCollection: PrimitiveCollection;
    transform: Matrix4;
    radius: number;
    pixelSize?: number;
    maximumSizeInMeters?: number;
};

class TranslationEditor {
    private _ignorePitchRoll: boolean = true;
    private _scene: Scene;
    private _canvas: HTMLCanvasElement;
    private _setPositionCallback: (origin: Cartesian3) => void;

    originOffset: Cartesian3;
    private _polylineX: AxisLinePrimitive;
    private _polylineY: AxisLinePrimitive;
    private _polylineZ: AxisLinePrimitive;

    private _modelMatrix: Matrix4;
    private _fixedFrame: Matrix4;
    private _hpr: HeadingPitchRoll;

    private _dragAlongVector: Cartesian3 | undefined;

    private _offsetVector: Cartesian3;
    private _pickingPlane: Plane;

    private _transform: Matrix4;
    private _radius: number;
    private _pixelSize: Cartesian2;
    private _maximumSizeInMeters: Cartesian2;

    private _dragging: boolean;
    private _active: boolean;

    constructor(options: ConstructorOptions) {
        if (options.ignorePitchRoll !== undefined) {
            this._ignorePitchRoll = options.ignorePitchRoll;
        }

        const scene = options.scene;

        this.originOffset = options.originOffset;
        const primitiveCollection = options.primitiveCollection;

        this._polylineX = primitiveCollection.add(getLinePrimitive(TransformAxis.X));
        this._polylineY = primitiveCollection.add(getLinePrimitive(TransformAxis.Y));
        this._polylineZ = primitiveCollection.add(getLinePrimitive(TransformAxis.Z));

        this._scene = scene;
        this._canvas = scene.canvas;
        this._setPositionCallback = options.setPosition;
        this._modelMatrix = new Matrix4();
        this._fixedFrame = new Matrix4();
        this._hpr = new HeadingPitchRoll();

        this._dragAlongVector = undefined;
        this._offsetVector = new Cartesian3();
        this._pickingPlane = new Plane(Cartesian3.UNIT_X, 0.0);
        this._dragging = false;
        this._active = false;

        this._transform = options.transform;
        this._radius = options.radius;
        this._pixelSize = defined(options.pixelSize)
            ? new Cartesian2(options.maximumSizeInMeters, options.pixelSize)
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
            this._polylineX.show = true;
            this._polylineY.show = true;
            this._polylineZ.show = true;
        } else {
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

    update() {
        const transform = this._transform;
        const ellipsoid = this._scene.mapProjection.ellipsoid;

        const modelOrigin = Matrix4.getTranslation(transform, originScratch);
        const widgetOrigin = getWidgetOrigin(transform, this.originOffset, widgetOriginScratch);

        const length = this._radius * Matrix4.getMaximumScale(this._transform) * 1.5;
        const hpr = Transforms.fixedFrameToHeadingPitchRoll(this._transform, ellipsoid, undefined, this._hpr);

        if (this._ignorePitchRoll) {
            hpr.pitch = 0;
            hpr.roll = 0;
        }

        let hprToFF = Transforms.headingPitchRollToFixedFrame(modelOrigin, hpr, ellipsoid, undefined, this._fixedFrame);
        hprToFF = Matrix4.setTranslation(hprToFF, widgetOrigin, hprToFF);
        let modelMatrix = Matrix4.multiplyByUniformScale(hprToFF, length, this._modelMatrix);

        if (this._pixelSize.x > 0)
            modelMatrix = getScreenSpaceScalingMatrix(
                this._pixelSize,
                this._maximumSizeInMeters,
                // @ts-ignore
                this._scene.frameState,
                modelMatrix,
                modelMatrix
            );

        this._polylineX.modelMatrix = modelMatrix;
        this._polylineY.modelMatrix = modelMatrix;
        this._polylineZ.modelMatrix = modelMatrix;
    }

    handleLeftDown(position: Cartesian2) {
        const scene = this._scene;
        const camera = scene.camera;

        const pickedObjects = scene.drillPick(position);

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

        const origin = Matrix4.getTranslation(this._transform, originScratch);
        const dragAlongVector = TransformAxis.getValue(pickedAxis);
        const directionVector = Matrix4.multiplyByPointAsVector(this._fixedFrame, dragAlongVector, directionScratch);

        // Finds a picking plane that includes the dragged axis and is somewhat perpendicular to the camera
        let planeNormal = planeNormalScratch;
        if (Math.abs(Cartesian3.dot(camera.upWC, directionVector)) > 0.7) {
            // if up and the direction are close to parellel, the dot product will be close to 1
            planeNormal = Cartesian3.cross(camera.rightWC, directionVector, planeNormal);
        } else {
            planeNormal = Cartesian3.cross(camera.upWC, directionVector, planeNormal);
        }
        Cartesian3.normalize(planeNormal, planeNormal);

        const pickingPlane = Plane.fromPointNormal(origin, planeNormal, this._pickingPlane);
        const offsetVector = IntersectionTests.rayPlane(
            camera.getPickRay(position, rayScratch)!,
            pickingPlane,
            this._offsetVector
        );
        if (!defined(offsetVector)) {
            return;
        }
        Cartesian3.subtract(offsetVector, origin, offsetVector);
        this._dragging = true;
        this._dragAlongVector = dragAlongVector;
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
        let origin = Matrix4.getTranslation(this._transform, originScratch);
        const directionVector = Matrix4.multiplyByPointAsVector(this._fixedFrame, dragAlongVector!, directionScratch);
        let moveVector = Cartesian3.subtract(pickedPoint, origin, moveScratch);
        moveVector = Cartesian3.projectVector(moveVector, directionVector, moveVector);
        const offset = Cartesian3.projectVector(this._offsetVector, directionVector, offsetProjectedScratch);
        moveVector = Cartesian3.subtract(moveVector, offset, moveVector);

        origin = Cartesian3.add(origin, moveVector, origin);
        this._setPositionCallback(origin);
    }

    handleLeftUp() {
        this._dragging = false;
        this._scene.screenSpaceCameraController.enableInputs = true;
    }

    // eslint-disable-next-line class-methods-use-this
    isDestroyed() {
        return false;
    }

    destroy() {
        this.active = false;
        const scene = this._scene;
        scene.primitives.remove(this._polylineX);
        scene.primitives.remove(this._polylineY);
        scene.primitives.remove(this._polylineZ);
        destroyObject(this);
    }
}

export default TranslationEditor;
