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
    PrimitiveCollection,
    Ray,
    Scene,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType,
    Transforms
} from "cesium";
import { AxisLinePrimitive, getUnitZCirclePositions } from "../../../../core";

import getWidgetOrigin from "../../../../core/getWidgetOrigin";

const scratchBoundingSphere = new BoundingSphere();
const noScale = new Cartesian3(1.0, 1.0, 1.0);
const polylineZId = "PolylineZ";

const offsetScratch = new Cartesian3();
const rotationWorldScratch = new Cartesian3();
const inverseTransformScratch = new Matrix4();
const localStartScratch = new Cartesian3();
const localEndScratch = new Cartesian3();
const vector1Scratch = new Cartesian3();
const vector2Scratch = new Cartesian3();
const rayScratch = new Ray();
const intersectionScratch = new Cartesian3();

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

const rotationAxis = Cartesian3.UNIT_Z;

interface RotationMarkerConstructorOptions {
    scene: Scene;
}

export default class RotationMarker {
    private readonly _scene: Scene;
    private readonly _primitiveCollection;
    private readonly _eventHandler: ScreenSpaceEventHandler;

    private _transform: Matrix4;
    private _currentRotationAngleByUp: number;
    private _accumulatedRotationAngle: number;
    private _draggingCirclePolylinePrimitive: boolean;
    private readonly _startTransform: Matrix4;
    private _startRotation: Matrix3;
    private originOffset: Cartesian3;
    private readonly _widgetOrigin: Cartesian3;
    private readonly _modelOrigin: Cartesian3;
    private readonly _rotationPlane: Plane;
    private readonly _rotationStartPoint: Cartesian3;

    private _vectorLine1?: AxisLinePrimitive;
    private _vectorLine2?: AxisLinePrimitive;
    private _polylineZ?: AxisLinePrimitive;

    private readonly _rotated: Event;
    private readonly _rotationFinished: Event;

    constructor(options: RotationMarkerConstructorOptions) {
        const scene = options.scene;

        this._scene = scene;

        this._transform = new Matrix4();

        this._currentRotationAngleByUp = 0;
        this._accumulatedRotationAngle = 0.0;
        this._draggingCirclePolylinePrimitive = false;
        this._startTransform = new Matrix4();
        this._startRotation = new Matrix3();
        this.originOffset = Cartesian3.ZERO;
        this._widgetOrigin = new Cartesian3();
        this._modelOrigin = new Cartesian3();
        this._rotationPlane = new Plane(Cartesian3.UNIT_X, 0.0);
        this._rotationStartPoint = new Cartesian3();
        this._eventHandler = new ScreenSpaceEventHandler(scene.canvas);

        this._eventHandler.setInputAction(this._handleLeftDown.bind(this), ScreenSpaceEventType.LEFT_DOWN);
        this._eventHandler.setInputAction(this._handleMouseMove.bind(this), ScreenSpaceEventType.MOUSE_MOVE);
        this._eventHandler.setInputAction(this._handleLeftUp.bind(this), ScreenSpaceEventType.LEFT_UP);

        this._primitiveCollection = new PrimitiveCollection();

        // @ts-ignore
        this._primitiveCollection.id = "RotationMarker-PrimitiveCollection";

        scene.primitives.add(this._primitiveCollection);

        this._createPrimitives();

        this._rotated = new Event();
        this._rotationFinished = new Event();
    }

    clear() {
        this._primitiveCollection.removeAll();

        this._createPrimitives();
    }

    _createPrimitives() {
        const primitiveCollection = this._primitiveCollection;

        this._vectorLine1 = primitiveCollection.add(
            new AxisLinePrimitive({
                width: 5,
                positions: [new Cartesian3(), new Cartesian3()],
                color: Color.RED,
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

        this._polylineZ = primitiveCollection.add(
            new AxisLinePrimitive({
                positions: getUnitZCirclePositions(),
                color: Color.BLUE,
                loop: true,
                show: false,
                id: polylineZId
            })
        );
    }

    get rotated() {
        return this._rotated;
    }

    get rotationFinished() {
        return this._rotationFinished;
    }

    _handleLeftDown(event: { position: Cartesian2 }) {
        const position = event.position;

        const scene = this._scene;
        const pickedObjects = scene.drillPick(position);
        let pickedAxis;

        for (let i = 0; i < pickedObjects.length; i++) {
            const object = pickedObjects[i];
            if (
                defined(object.id) &&
                object.id === polylineZId &&
                Object.is(object.primitive, this._polylineZ?.primitive)
            ) {
                pickedAxis = object.id;
                break;
            }
        }

        if (!defined(pickedAxis)) {
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
        const rotationStartPoint = IntersectionTests.rayPlane(ray!, rotationPlane, this._rotationStartPoint);

        this._draggingCirclePolylinePrimitive = defined(rotationStartPoint);
        scene.screenSpaceCameraController.enableInputs = false;
    }

    _doHighlightOrUnHighlightLogicPolylineZ(movement: { endPosition: Cartesian2 }) {
        const position = movement.endPosition;

        const scene = this._scene;
        const pickedObject = scene.pick(position);

        if (pickedObject && pickedObject.id && pickedObject.id === polylineZId) {
            if (!Color.equals(this._polylineZ!.color, Color.YELLOW)) {
                this._polylineZ!.color = Color.YELLOW;
            }

            return;
        }

        if (!Color.equals(this._polylineZ!.color, Color.BLUE)) {
            this._polylineZ!.color = Color.BLUE;
        }
    }

    _handleMouseMove(movement: { endPosition: Cartesian2 }) {
        this._doHighlightOrUnHighlightLogicPolylineZ(movement);

        if (!this._draggingCirclePolylinePrimitive) {
            return;
        }

        const scene = this._scene;
        const position = movement.endPosition;
        const ray = scene.camera.getPickRay(position, rayScratch);
        let intersection = IntersectionTests.rayPlane(ray!, this._rotationPlane, intersectionScratch);

        if (!defined(intersection)) {
            return;
        }

        const widgetOrigin = this._widgetOrigin;
        const rotationStartPoint = this._rotationStartPoint;
        const vector1 = this._vectorLine1;
        const v1Pos = vector1!.positions;
        const vector2 = this._vectorLine2;
        const v2Pos = vector2!.positions;

        const v1 = Cartesian3.subtract(rotationStartPoint, widgetOrigin, vector1Scratch);
        let v2 = Cartesian3.subtract(intersection, widgetOrigin, vector2Scratch);

        v2 = Cartesian3.normalize(v2, v2);
        v2 = Cartesian3.multiplyByScalar(v2, Cartesian3.magnitude(v1), v2);

        intersection = Cartesian3.add(widgetOrigin, v2, intersection);

        v1Pos[0] = widgetOrigin;
        v1Pos[1] = rotationStartPoint;
        v2Pos[0] = widgetOrigin;
        v2Pos[1] = intersection;

        vector1!.positions = v1Pos;
        vector2!.positions = v2Pos;
        vector1!.show = true;
        vector2!.show = true;

        const offset = Cartesian3.multiplyComponents(
            this.originOffset,
            Matrix4.getScale(this._transform, offsetScratch),
            offsetScratch
        );

        const angle = getRotationAngle(this._startTransform, offset, rotationAxis, rotationStartPoint, intersection);

        this._currentRotationAngleByUp = angle;

        // @ts-ignore
        this._rotated.raiseEvent(angle);
    }

    _handleLeftUp() {
        if (!this._draggingCirclePolylinePrimitive) {
            return;
        }

        this._draggingCirclePolylinePrimitive = false;
        this._vectorLine1!.show = false;
        this._vectorLine2!.show = false;
        this._scene.screenSpaceCameraController.enableInputs = true;

        this._accumulatedRotationAngle += this._currentRotationAngleByUp;

        this._rotationFinished.raiseEvent();
    }

    update(positions: Cartesian3[]) {
        const boundingSphere = BoundingSphere.fromPoints(positions, scratchBoundingSphere);

        Transforms.eastNorthUpToFixedFrame(boundingSphere.center, undefined, this._transform);

        const radius = boundingSphere.radius * Matrix4.getMaximumScale(this._transform) * 1.25;

        this._polylineZ!.modelMatrix = Matrix4.multiplyByUniformScale(this._transform, radius, new Matrix4());
    }

    get accumulatedRotationAngle() {
        return this._accumulatedRotationAngle;
    }

    reset() {
        this._accumulatedRotationAngle = 0;
    }

    get show() {
        return this._polylineZ!.show;
    }

    set show(b: boolean) {
        this._polylineZ!.show = b;
    }

    destroy() {
        this._primitiveCollection.remove(this._vectorLine1);
        this._primitiveCollection.remove(this._vectorLine2);
        this._primitiveCollection.remove(this._polylineZ);

        destroyObject(this);
    }
}
