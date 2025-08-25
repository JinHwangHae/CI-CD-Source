/* qeslint-disable */
// q@ts-nocheck

import {
    Cartesian3,
    Cartesian2,
    defined,
    destroyObject,
    Color,
    HeadingPitchRoll,
    IntersectionTests,
    Math as CesiumMath,
    Matrix3,
    Matrix4,
    Plane,
    Quaternion,
    Ray,
    Transforms,
    Scene,
    PrimitiveCollection
} from "cesium";

import getWidgetOrigin from "../getWidgetOrigin";
import { AxisLinePrimitive } from "../primitives";
import TransformAxis from "./TransformAxis";

import getScreenSpaceScalingMatrix from "../getScreenSpaceScalingMatrix";

const noScale = new Cartesian3(1.0, 1.0, 1.0);
const offsetScratch = new Cartesian3();
const widgetOriginScratch = new Cartesian3();
const rotationWorldScratch = new Cartesian3();
const rotatedTransformScratch = new Matrix4();
const inverseTransformScratch = new Matrix4();
const localStartScratch = new Cartesian3();
const localEndScratch = new Cartesian3();
const vector1Scratch = new Cartesian3();
const vector2Scratch = new Cartesian3();
const hprScratch = new HeadingPitchRoll();
const rayScratch = new Ray();
const intersectionScratch = new Cartesian3();
const quaternionScratch = new Quaternion();
const matrix3Scratch = new Matrix3();
const defaultPixelSize = 100;
const defaultMaximumMeterSize = 1 / 0;

function getUnitCirclePositions() {
    const xAxis = [];
    const yAxis = [];
    const zAxis = [];

    for (let i = 0; i < 360; i++) {
        const rad = CesiumMath.toRadians(i);
        const x = Math.cos(rad);
        const y = Math.sin(rad);

        xAxis.push(new Cartesian3(0.0, x, y));
        yAxis.push(new Cartesian3(y, 0.0, x));
        zAxis.push(new Cartesian3(x, y, 0.0));
    }
    return {
        x: xAxis,
        y: yAxis,
        z: zAxis
    };
}

function getRotationAngle(
    transform: Matrix4,
    originOffset: Cartesian3,
    axis: Cartesian3,
    start: Cartesian3,
    end: Cartesian3
) {
    const inverseTransform = Matrix4.inverse(transform, inverseTransformScratch);
    let localStart = Matrix4.multiplyByPoint(inverseTransform, start, localStartScratch); // project points to local coordinates so we can project to 2D
    let localEnd = Matrix4.multiplyByPoint(inverseTransform, end, localEndScratch);

    localStart = Cartesian3.subtract(localStart, originOffset, localStart);
    localEnd = Cartesian3.subtract(localEnd, originOffset, localEnd);

    const v1 = vector1Scratch;
    const v2 = vector2Scratch;
    if (axis.x) {
        v1.x = localStart.y;
        v1.y = localStart.z;
        v2.x = localEnd.y;
        v2.y = localEnd.z;
    } else if (axis.y) {
        v1.x = -localStart.x;
        v1.y = localStart.z;
        v2.x = -localEnd.x;
        v2.y = localEnd.z;
    } else {
        v1.x = localStart.x;
        v1.y = localStart.y;
        v2.x = localEnd.x;
        v2.y = localEnd.y;
    }

    const ccw = v1.x * v2.y - v1.y * v2.x >= 0.0; // true when minimal angle between start and end is a counter clockwise rotation

    let angle = Cartesian2.angleBetween(v1, v2);
    if (!ccw) {
        angle = -angle;
    }
    return angle;
}

function getLinePrimitive(positions: Cartesian3[], axis: string, id: any) {
    return new AxisLinePrimitive({
        positions: positions,
        color: TransformAxis.getColor(axis),
        loop: true,
        show: false,
        id: id
    });
}

const AxisIds = {
    X: "XAxisOfRotationEditor",
    Y: "YAxisOfRotationEditor",
    Z: "ZAxisOfRotationEditor"
};

interface ConstructorOptions {
    scene: Scene;
    primitiveCollection: PrimitiveCollection;
    originOffset: Cartesian3;
    transform: Matrix4;
    radius: number;
    setPosition: (value: Cartesian3) => void;
    setHeadingPitchRoll: (value: HeadingPitchRoll) => void;
    pixelSize?: number;
    maximumSizeInMeters?: number;
}

class RotationEditor {
    private readonly _vectorLine1: AxisLinePrimitive;
    private readonly _vectorLine2: AxisLinePrimitive;
    private readonly _polylineX: AxisLinePrimitive;
    private readonly _polylineY: AxisLinePrimitive;
    private readonly _polylineZ: AxisLinePrimitive;
    private readonly _modelMatrix: Matrix4;
    originOffset: Cartesian3;
    private readonly _scene: Scene;
    private readonly _setHPRCallback: (value: HeadingPitchRoll) => void;
    private _setPositionCallback: (value: Cartesian3) => void;

    private readonly _transform: Matrix4;
    private readonly _radius: number;
    private _active: boolean;
    private _dragging: boolean;
    private readonly _startTransform: Matrix4;
    private _startRotation: Matrix3;
    private readonly _widgetOrigin: Cartesian3;
    private readonly _modelOrigin: Cartesian3;
    private _rotationAxis: Cartesian3 | undefined;
    private readonly _rotationPlane: Plane;
    private readonly _rotationStartPoint: Cartesian3;
    private readonly _pixelSize: Cartesian2;
    private readonly _maximumSizeInMeters: Cartesian2;

    constructor(options: ConstructorOptions) {
        const scene = options.scene;

        const primitiveCollection = options.primitiveCollection;

        this._vectorLine1 = primitiveCollection.add(
            new AxisLinePrimitive({
                width: 5,
                positions: [new Cartesian3(), new Cartesian3()],
                color: Color.YELLOW,
                show: false
            })
        );
        this._vectorLine2 = primitiveCollection.add(
            new AxisLinePrimitive({
                width: 5,
                positions: [new Cartesian3(), new Cartesian3()],
                color: Color.YELLOW,
                show: false
            })
        );

        const circles = getUnitCirclePositions();

        this._polylineX = primitiveCollection.add(getLinePrimitive(circles.x, TransformAxis.X, AxisIds.X));
        this._polylineY = primitiveCollection.add(getLinePrimitive(circles.y, TransformAxis.Y, AxisIds.Y));
        this._polylineZ = primitiveCollection.add(getLinePrimitive(circles.z, TransformAxis.Z, AxisIds.Z));
        this._modelMatrix = Matrix4.clone(Matrix4.IDENTITY);

        this.originOffset = options.originOffset;
        this._scene = scene;
        this._setHPRCallback = options.setHeadingPitchRoll;
        this._setPositionCallback = options.setPosition;
        this._transform = options.transform;
        this._radius = options.radius;

        this._active = false;
        this._dragging = false;
        this._startTransform = new Matrix4();
        this._startRotation = new Matrix3();
        this._widgetOrigin = new Cartesian3();
        this._modelOrigin = new Cartesian3();
        this._rotationAxis = undefined;
        this._rotationPlane = new Plane(Cartesian3.UNIT_X, 0.0);
        this._rotationStartPoint = new Cartesian3();
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

    set active(active: boolean) {
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
        let modelMatrix = this._modelMatrix;
        modelMatrix = Matrix4.setScale(transform, noScale, modelMatrix);

        const widgetOrigin = getWidgetOrigin(transform, this.originOffset, widgetOriginScratch);
        modelMatrix = Matrix4.setTranslation(modelMatrix, widgetOrigin, modelMatrix);

        const radius = this._radius * Matrix4.getMaximumScale(this._transform) * 1.25;
        modelMatrix = Matrix4.multiplyByUniformScale(modelMatrix, radius, modelMatrix);

        if (this._pixelSize.x > 0)
            modelMatrix = getScreenSpaceScalingMatrix(
                this._pixelSize,
                this._maximumSizeInMeters,
                // @ts-ignore
                this._scene.frameState,
                modelMatrix,
                modelMatrix
            );

        // @ts-ignore
        this._polylineX.modelMatrix = modelMatrix;
        // @ts-ignore
        this._polylineY.modelMatrix = modelMatrix;
        // @ts-ignore
        this._polylineZ.modelMatrix = modelMatrix;
    }

    handleLeftDown(position: Cartesian2) {
        const scene = this._scene;
        const pickedObjects = scene.drillPick(position);
        let pickedObjectId;
        let pickedAxis;
        for (let i = 0; i < pickedObjects.length; i++) {
            const object = pickedObjects[i];
            if (defined(object.id)) {
                pickedObjectId = object.id;
                break;
            }
        }

        if (!defined(pickedObjectId)) {
            return;
        }

        if (pickedObjectId === AxisIds.X) {
            pickedAxis = TransformAxis.X;
        } else if (pickedObjectId === AxisIds.Y) {
            pickedAxis = TransformAxis.Y;
        } else if (pickedObjectId === AxisIds.Z) {
            pickedAxis = TransformAxis.Z;
        } else {
            return;
        }

        const rotationAxis = TransformAxis.getValue(pickedAxis);
        const startTransform = Matrix4.setScale(this._transform, noScale, this._startTransform);
        this._startRotation = Matrix4.getMatrix3(startTransform, this._startRotation);
        const modelOrigin = Matrix4.getTranslation(startTransform, this._modelOrigin);

        const widgetOrigin = getWidgetOrigin(this._transform, this.originOffset, this._widgetOrigin);

        const rotationAxisEndWorld = Matrix4.multiplyByPoint(startTransform, rotationAxis, rotationWorldScratch);
        let rotationAxisVectorWorld = Cartesian3.subtract(rotationAxisEndWorld, modelOrigin, rotationAxisEndWorld);
        rotationAxisVectorWorld = Cartesian3.normalize(rotationAxisVectorWorld, rotationAxisVectorWorld);

        const rotationPlane = Plane.fromPointNormal(widgetOrigin, rotationAxisVectorWorld, this._rotationPlane);
        const rotationStartPoint = IntersectionTests.rayPlane(
            // @ts-ignore
            scene.camera.getPickRay(position, rayScratch),
            rotationPlane,
            this._rotationStartPoint
        );
        this._dragging = defined(rotationStartPoint);
        this._rotationAxis = rotationAxis;
        scene.screenSpaceCameraController.enableInputs = false;
    }

    handleMouseMove(position: Cartesian2) {
        if (!this._dragging) {
            return;
        }
        const scene = this._scene;
        const ray = scene.camera.getPickRay(position, rayScratch);

        if (!ray) {
            return;
        }

        let intersection = IntersectionTests.rayPlane(ray, this._rotationPlane, intersectionScratch);

        if (!defined(intersection)) {
            return;
        }

        const widgetOrigin = this._widgetOrigin;
        let modelOrigin = this._modelOrigin;
        const rotationStartPoint = this._rotationStartPoint;
        const vector1 = this._vectorLine1;
        // @ts-ignore
        const v1Pos = vector1.positions;
        const vector2 = this._vectorLine2;
        // @ts-ignore
        const v2Pos = vector2.positions;

        const v1 = Cartesian3.subtract(rotationStartPoint, widgetOrigin, vector1Scratch);
        let v2 = Cartesian3.subtract(intersection, widgetOrigin, vector2Scratch);
        v2 = Cartesian3.normalize(v2, v2);
        v2 = Cartesian3.multiplyByScalar(v2, Cartesian3.magnitude(v1), v2);
        intersection = Cartesian3.add(widgetOrigin, v2, intersection);

        v1Pos[0] = widgetOrigin;
        v1Pos[1] = rotationStartPoint;
        v2Pos[0] = widgetOrigin;
        v2Pos[1] = intersection;
        // @ts-ignore
        vector1.positions = v1Pos;
        // @ts-ignore
        vector2.positions = v2Pos;
        vector1.show = true;
        vector2.show = true;

        const offset = Cartesian3.multiplyComponents(
            this.originOffset,
            Matrix4.getScale(this._transform, offsetScratch),
            offsetScratch
        );
        const rotationAxis = this._rotationAxis;
        const angle = getRotationAngle(this._startTransform, offset, rotationAxis!, rotationStartPoint, intersection);
        let rotation = Matrix3.fromQuaternion(
            Quaternion.fromAxisAngle(rotationAxis!, angle, quaternionScratch),
            matrix3Scratch
        );

        rotation = Matrix3.multiply(this._startRotation, rotation, rotation);
        const rotationTransform = Matrix4.fromRotationTranslation(rotation, modelOrigin, rotatedTransformScratch);
        this._setHPRCallback(
            // @ts-ignore
            Transforms.fixedFrameToHeadingPitchRoll(
                rotationTransform,
                scene.mapProjection.ellipsoid,
                undefined,
                hprScratch
            )
        );

        let newOffset = Cartesian3.negate(offset, vector1Scratch);
        newOffset = Matrix3.multiplyByVector(rotation, newOffset, newOffset);

        modelOrigin = Cartesian3.add(newOffset, widgetOrigin, modelOrigin);
        this._setPositionCallback(modelOrigin);
    }

    handleLeftUp() {
        this._dragging = false;
        this._vectorLine1.show = false;
        this._vectorLine2.show = false;
        this._scene.screenSpaceCameraController.enableInputs = true;
    }

    // eslint-disable-next-line class-methods-use-this
    isDestroyed() {
        return false;
    }

    destroy() {
        this.active = false;
        const scene = this._scene;

        scene.primitives.remove(this._vectorLine1);
        scene.primitives.remove(this._vectorLine2);
        scene.primitives.remove(this._polylineX);
        scene.primitives.remove(this._polylineY);
        scene.primitives.remove(this._polylineZ);

        destroyObject(this);
    }

    hideXY() {
        this._polylineX.show = false;
        this._polylineY.show = false;
    }
}

export default RotationEditor;
