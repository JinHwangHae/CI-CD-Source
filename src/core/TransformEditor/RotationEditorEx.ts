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
    Matrix3,
    Matrix4,
    Plane,
    PrimitiveCollection,
    Quaternion,
    Ray,
    Transforms,
    Scene
} from "cesium";

import getWidgetOrigin from "../getWidgetOrigin";
import { Axes, CircleRulerPrimitive } from "../primitives";
import { createOrUpdateLabel, DimensionLabel } from "../label";
import { getRotationAngle } from "../common";

const noScale = new Cartesian3(1.0, 1.0, 1.0);
const offsetScratch = new Cartesian3();
const rotationWorldScratch = new Cartesian3();
const rotatedTransformScratch = new Matrix4();
const vector1Scratch = new Cartesian3();
const vector2Scratch = new Cartesian3();
const hprScratch = new HeadingPitchRoll();
const rayScratch = new Ray();
const intersectionScratch = new Cartesian3();
const quaternionScratch = new Quaternion();
const matrix3Scratch = new Matrix3();
const defaultPixelSize = 100;
const defaultMaximumMeterSize = 1 / 0;

enum AxisIds {
    X = "circle-x",
    Y = "circle-y",
    Z = "circle-z"
}

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

export class RotationEditorEx {
    private readonly _modelMatrix: Matrix4;
    originOffset: Cartesian3;
    private readonly _scene: Scene;
    private readonly _setHPRCallback: (value: HeadingPitchRoll) => void;
    private _setPositionCallback: (value: Cartesian3) => void;

    private readonly _transform: Matrix4;
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
    private readonly _circleRulerPrimitiveX: CircleRulerPrimitive;
    private readonly _circleRulerPrimitiveY: CircleRulerPrimitive;
    private readonly _circleRulerPrimitiveZ: CircleRulerPrimitive;
    private _selectedCircleRulerPrimitive: CircleRulerPrimitive | undefined;
    private _label: DimensionLabel | undefined;

    constructor(options: ConstructorOptions) {
        const scene = options.scene;

        const primitiveCollection = options.primitiveCollection;

        this._modelMatrix = Matrix4.clone(Matrix4.IDENTITY);

        this._circleRulerPrimitiveX = new CircleRulerPrimitive({
            axis: Axes.x,
            show: false,
            entityId: AxisIds.X,
            angle: 0,
            height: 0,
            modelMatrix: this._modelMatrix,
            radius: options.radius,
            color: Color.RED,
            showAngle: false,
            showDegrees: false
        });

        primitiveCollection.add(this._circleRulerPrimitiveX);

        this._circleRulerPrimitiveY = new CircleRulerPrimitive({
            axis: Axes.y,
            show: false,
            entityId: AxisIds.Y,
            angle: 0,
            height: 0,
            modelMatrix: this._modelMatrix,
            radius: options.radius,
            color: Color.GREEN,
            showAngle: false,
            showDegrees: false
        });

        primitiveCollection.add(this._circleRulerPrimitiveY);

        this._circleRulerPrimitiveZ = new CircleRulerPrimitive({
            axis: Axes.z,
            show: false,
            entityId: AxisIds.Z,
            angle: 0,
            height: 0,
            modelMatrix: this._modelMatrix,
            radius: options.radius,
            color: Color.BLUE,
            showAngle: false,
            showDegrees: false
        });

        primitiveCollection.add(this._circleRulerPrimitiveZ);

        this.originOffset = options.originOffset;
        this._scene = scene;
        this._setHPRCallback = options.setHeadingPitchRoll;
        this._setPositionCallback = options.setPosition;
        this._transform = options.transform;

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
            this._circleRulerPrimitiveX.show = true;
            this._circleRulerPrimitiveY.show = true;
            this._circleRulerPrimitiveZ.show = true;
        } else {
            this._circleRulerPrimitiveX.show = false;
            this._circleRulerPrimitiveY.show = false;
            this._circleRulerPrimitiveZ.show = false;
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

        this._circleRulerPrimitiveX.modelMatrix = transform;
        this._circleRulerPrimitiveY.modelMatrix = transform;
        this._circleRulerPrimitiveZ.modelMatrix = transform;
    }

    handleLeftDown(position: Cartesian2) {
        const scene = this._scene;
        const pickedObjects = scene.drillPick(position);
        let pickedObjectId;
        let rotationAxis;
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

        if (pickedObjectId === `${AxisIds.X}:rotation:rotation-circle`) {
            rotationAxis = Cartesian3.UNIT_X;

            this._selectedCircleRulerPrimitive = this._circleRulerPrimitiveX;
        } else if (pickedObjectId === `${AxisIds.Y}:rotation:rotation-circle`) {
            rotationAxis = Cartesian3.UNIT_Y;

            this._selectedCircleRulerPrimitive = this._circleRulerPrimitiveY;
        } else if (pickedObjectId === `${AxisIds.Z}:rotation:rotation-circle`) {
            rotationAxis = Cartesian3.UNIT_Z;

            this._selectedCircleRulerPrimitive = this._circleRulerPrimitiveZ;
        } else {
            return;
        }

        const startTransform = Matrix4.setScale(this._transform, noScale, this._startTransform);
        this._startRotation = Matrix4.getMatrix3(startTransform, this._startRotation);
        const modelOrigin = Matrix4.getTranslation(startTransform, this._modelOrigin);

        const widgetOrigin = getWidgetOrigin(this._transform, this.originOffset, this._widgetOrigin);

        const rotationAxisEndWorld = Matrix4.multiplyByPoint(startTransform, rotationAxis, rotationWorldScratch);
        let rotationAxisVectorWorld = Cartesian3.subtract(rotationAxisEndWorld, modelOrigin, rotationAxisEndWorld);
        rotationAxisVectorWorld = Cartesian3.normalize(rotationAxisVectorWorld, rotationAxisVectorWorld);

        const rotationPlane = Plane.fromPointNormal(widgetOrigin, rotationAxisVectorWorld, this._rotationPlane);
        const ray = scene.camera.getPickRay(position, rayScratch);

        if (!ray) {
            return;
        }

        const rotationStartPoint = IntersectionTests.rayPlane(ray, rotationPlane, this._rotationStartPoint);

        this._dragging = defined(rotationStartPoint);
        this._rotationAxis = rotationAxis;
        scene.screenSpaceCameraController.enableInputs = false;

        if (this._selectedCircleRulerPrimitive) {
            this._selectedCircleRulerPrimitive.determineRotationStartAngle(this._rotationStartPoint);
            this._selectedCircleRulerPrimitive.showAngle = true;
            this._selectedCircleRulerPrimitive.showDegrees = true;
        }
    }

    _highlighting(position: Cartesian2) {
        this._circleRulerPrimitiveX.highlightRotate = false;
        this._circleRulerPrimitiveY.highlightRotate = false;
        this._circleRulerPrimitiveZ.highlightRotate = false;

        const scene = this._scene;
        const pickedObjects = scene.drillPick(position);
        let pickedObjectId;

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

        if (pickedObjectId === `${AxisIds.X}:rotation:rotation-circle`) {
            this._circleRulerPrimitiveX.highlightRotate = true;
        } else if (pickedObjectId === `${AxisIds.Y}:rotation:rotation-circle`) {
            this._circleRulerPrimitiveY.highlightRotate = true;
        } else if (pickedObjectId === `${AxisIds.Z}:rotation:rotation-circle`) {
            this._circleRulerPrimitiveZ.highlightRotate = true;
        }
    }

    handleMouseMove(position: Cartesian2) {
        if (!this._dragging) {
            this._highlighting(position);
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

        const v1 = Cartesian3.subtract(rotationStartPoint, widgetOrigin, vector1Scratch);
        let v2 = Cartesian3.subtract(intersection, widgetOrigin, vector2Scratch);
        v2 = Cartesian3.normalize(v2, v2);
        v2 = Cartesian3.multiplyByScalar(v2, Cartesian3.magnitude(v1), v2);
        intersection = Cartesian3.add(widgetOrigin, v2, intersection);

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

        if (this._selectedCircleRulerPrimitive) {
            this._selectedCircleRulerPrimitive.angle = angle;

            let localPosition;

            if (this._selectedCircleRulerPrimitive.entityId === AxisIds.X) {
                localPosition = new Cartesian3(0, this._selectedCircleRulerPrimitive.radius, 0);
            } else if (this._selectedCircleRulerPrimitive.entityId === AxisIds.Y) {
                localPosition = new Cartesian3(0, this._selectedCircleRulerPrimitive.radius, 0);
            } else {
                localPosition = new Cartesian3(this._selectedCircleRulerPrimitive.radius, 0, 0);
            }

            const labelService = window.Construkted.labelService;

            this._label = createOrUpdateLabel(
                this._modelOrigin,
                angle,
                this._selectedCircleRulerPrimitive!.modelMatrix,
                localPosition,
                labelService.viewer,
                labelService,
                this._label
            );
        }
    }

    handleLeftUp() {
        this._dragging = false;

        this._scene.screenSpaceCameraController.enableInputs = true;

        if (this._selectedCircleRulerPrimitive) {
            this._selectedCircleRulerPrimitive.showAngle = false;
            this._selectedCircleRulerPrimitive.showDegrees = false;

            this._selectedCircleRulerPrimitive = undefined;
        }

        this._rotationAxis = undefined;

        this._label?.destroy();
        this._label = undefined;
    }

    // eslint-disable-next-line class-methods-use-this
    isDestroyed() {
        return false;
    }

    destroy() {
        this.active = false;
        const scene = this._scene;

        scene.primitives.remove(this._circleRulerPrimitiveX);
        scene.primitives.remove(this._circleRulerPrimitiveY);
        scene.primitives.remove(this._circleRulerPrimitiveZ);

        destroyObject(this);
    }
}
