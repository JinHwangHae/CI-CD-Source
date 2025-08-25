import {
    BoundingSphere,
    Cartesian2,
    Cartesian3,
    Color,
    defined,
    destroyObject,
    Event,
    IntersectionTests,
    Matrix3,
    Matrix4,
    Plane,
    Ray,
    ScreenSpaceEventHandler,
    Scene,
    ScreenSpaceEventType,
    Transforms
} from "cesium";
import { Axes, createOrUpdateLabel, CircleRulerPrimitive, DimensionLabel, getRotationAngle } from "../../../../core";

interface ConstructorOptions {
    scene: Scene;
    pixelSize?: number;
    maximumSizeInMeters?: number;
}

const scratchBoundingSphere = new BoundingSphere();
const noScale = new Cartesian3(1.0, 1.0, 1.0);
const offsetScratch = new Cartesian3();
const rotationWorldScratch = new Cartesian3();
const vector1Scratch = new Cartesian3();
const vector2Scratch = new Cartesian3();
const rayScratch = new Ray();
const intersectionScratch = new Cartesian3();

const circleRulerId = "circle-ruler-id";

export class RotationMarkerEx {
    private readonly _scene: Scene;
    private readonly _circleRulerPrimitiveZ: CircleRulerPrimitive;
    private _dragging: boolean;
    private readonly originOffset: Cartesian3;
    private readonly _startTransform: Matrix4;
    private readonly _transform: Matrix4;

    private _startRotation: Matrix3;
    private readonly _modelOrigin: Cartesian3;
    private _rotationAxis: Cartesian3 | undefined;
    private readonly _rotationPlane: Plane;
    private readonly _rotationStartPoint: Cartesian3;
    private readonly _eventHandler: ScreenSpaceEventHandler;
    private readonly _rotated: Event;
    private readonly _rotationFinished: Event;
    private _label: DimensionLabel | undefined;
    private _currentRotationAngleByUp: number = 0;
    private _accumulatedRotationAngle: number = 0;

    constructor(options: ConstructorOptions) {
        const scene = options.scene;

        this._scene = scene;

        this.originOffset = new Cartesian3();

        this._transform = new Matrix4();

        Matrix4.clone(Matrix4.IDENTITY, this._transform);

        this._circleRulerPrimitiveZ = new CircleRulerPrimitive({
            axis: Axes.z,
            show: true,
            entityId: circleRulerId,
            angle: 0,
            height: 0,
            modelMatrix: this._transform,
            radius: 1,
            color: Color.BLUE,
            showAngle: false,
            showDegrees: false
        });

        scene.primitives.add(this._circleRulerPrimitiveZ);

        this._dragging = false;
        this._startTransform = new Matrix4();
        this._startRotation = new Matrix3();
        this._modelOrigin = new Cartesian3();
        this._rotationAxis = undefined;
        this._rotationPlane = new Plane(Cartesian3.UNIT_X, 0.0);
        this._rotationStartPoint = new Cartesian3();
        this._eventHandler = new ScreenSpaceEventHandler(scene.canvas);

        this._eventHandler.setInputAction(this._handleLeftDown.bind(this), ScreenSpaceEventType.LEFT_DOWN);
        this._eventHandler.setInputAction(this._handleMouseMove.bind(this), ScreenSpaceEventType.MOUSE_MOVE);
        this._eventHandler.setInputAction(this._handleLeftUp.bind(this), ScreenSpaceEventType.LEFT_UP);

        this._rotated = new Event();
        this._rotationFinished = new Event();
    }

    get rotated() {
        return this._rotated;
    }

    get rotationFinished() {
        return this._rotationFinished;
    }

    _handleLeftDown(event: { position: Cartesian2 }) {
        const scene = this._scene;
        const pickedObjects = scene.drillPick(event.position);
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

        if (pickedObjectId === `${circleRulerId}:rotation:rotation-circle`) {
            rotationAxis = Cartesian3.UNIT_Z;
        } else {
            return;
        }

        const startTransform = Matrix4.setScale(this._transform, noScale, this._startTransform);
        this._startRotation = Matrix4.getMatrix3(startTransform, this._startRotation);
        const modelOrigin = Matrix4.getTranslation(startTransform, this._modelOrigin);

        const rotationAxisEndWorld = Matrix4.multiplyByPoint(startTransform, rotationAxis, rotationWorldScratch);
        let rotationAxisVectorWorld = Cartesian3.subtract(rotationAxisEndWorld, modelOrigin, rotationAxisEndWorld);
        rotationAxisVectorWorld = Cartesian3.normalize(rotationAxisVectorWorld, rotationAxisVectorWorld);

        const rotationPlane = Plane.fromPointNormal(modelOrigin, rotationAxisVectorWorld, this._rotationPlane);
        const rotationStartPoint = IntersectionTests.rayPlane(
            // @ts-ignore
            scene.camera.getPickRay(event.position, rayScratch),
            rotationPlane,
            this._rotationStartPoint
        );
        this._dragging = defined(rotationStartPoint);
        this._rotationAxis = rotationAxis;
        scene.screenSpaceCameraController.enableInputs = false;

        this._circleRulerPrimitiveZ.determineRotationStartAngle(this._rotationStartPoint);
        this._circleRulerPrimitiveZ.showAngle = true;
        this._circleRulerPrimitiveZ.showDegrees = true;
    }

    _highlighting(position: Cartesian2) {
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

        if (pickedObjectId === `${circleRulerId}:rotation:rotation-circle`) {
            this._circleRulerPrimitiveZ.highlightRotate = true;
        }
    }

    _handleMouseMove(movement: { endPosition: Cartesian2 }) {
        if (!this._dragging) {
            this._highlighting(movement.endPosition);
            return;
        }

        const scene = this._scene;
        const ray = scene.camera.getPickRay(movement.endPosition, rayScratch);

        if (!ray) {
            return;
        }

        let intersection = IntersectionTests.rayPlane(ray, this._rotationPlane, intersectionScratch);

        if (!defined(intersection)) {
            return;
        }

        const modelOrigin = this._modelOrigin;
        const rotationStartPoint = this._rotationStartPoint;

        const v1 = Cartesian3.subtract(rotationStartPoint, modelOrigin, vector1Scratch);
        let v2 = Cartesian3.subtract(intersection, modelOrigin, vector2Scratch);
        v2 = Cartesian3.normalize(v2, v2);
        v2 = Cartesian3.multiplyByScalar(v2, Cartesian3.magnitude(v1), v2);
        intersection = Cartesian3.add(modelOrigin, v2, intersection);

        const offset = Cartesian3.multiplyComponents(
            this.originOffset,
            Matrix4.getScale(this._transform, offsetScratch),
            offsetScratch
        );
        const rotationAxis = this._rotationAxis;
        const angle = getRotationAngle(this._startTransform, offset, rotationAxis!, rotationStartPoint, intersection);

        this._currentRotationAngleByUp = angle;

        // @ts-ignore
        this._rotated.raiseEvent(angle);

        const circleRulerPrimitive = this._circleRulerPrimitiveZ;

        circleRulerPrimitive.angle = angle;

        const localPosition = new Cartesian3(0, circleRulerPrimitive.radius, 0);

        const labelService = window.Construkted.labelService;

        this._label = createOrUpdateLabel(
            this._modelOrigin,
            angle,
            circleRulerPrimitive.modelMatrix,
            localPosition,
            labelService.viewer,
            labelService,
            this._label
        );
    }

    _handleLeftUp() {
        if (this._dragging) {
            this._circleRulerPrimitiveZ.showAngle = false;
            this._circleRulerPrimitiveZ.showDegrees = false;
        }

        this._dragging = false;

        this._scene.screenSpaceCameraController.enableInputs = true;

        this._label?.destroy();
        this._label = undefined;
        this._accumulatedRotationAngle += this._currentRotationAngleByUp;
        this._rotationFinished.raiseEvent();
    }

    update(positions: Cartesian3[]) {
        const boundingSphere = BoundingSphere.fromPoints(positions, scratchBoundingSphere);
        const radius = boundingSphere.radius * 1.25;
        this._circleRulerPrimitiveZ.radius = radius;
        this._circleRulerPrimitiveZ.modelMatrix = Transforms.eastNorthUpToFixedFrame(
            boundingSphere.center,
            undefined,
            this._transform
        );
    }

    get show() {
        return this._circleRulerPrimitiveZ.show;
    }

    set show(b: boolean) {
        this._circleRulerPrimitiveZ.show = b;
    }

    // eslint-disable-next-line class-methods-use-this
    clear() {}

    get accumulatedRotationAngle() {
        return this._accumulatedRotationAngle;
    }

    reset() {
        this._accumulatedRotationAngle = 0;
    }

    destroy() {
        const scene = this._scene;

        scene.primitives.remove(this._circleRulerPrimitiveZ);

        destroyObject(this);
    }
}
