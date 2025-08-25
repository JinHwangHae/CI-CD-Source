/* qeslint-disable */
// q@ts-nocheck

import {
    Cartesian2,
    Cartesian3,
    Cartographic,
    Cesium3DTileset,
    Clock,
    Color,
    defined,
    FrameRateMonitor,
    Event,
    HeadingPitchRoll,
    HorizontalOrigin,
    Matrix4,
    Math as CesiumMath,
    PointPrimitive,
    PointPrimitiveCollection,
    Label,
    LabelCollection,
    LabelStyle,
    PrimitiveCollection,
    Ray,
    ScreenSpaceEventType,
    VerticalOrigin
} from "cesium";

import { getSlope } from "./core";

import { CesiumCameraController, CesiumCameraControllerConstructorOptions } from "./CesiumCameraController";
import { enableDefaultScreenSpaceCameraController, disableDefaultScreenSpaceCameraController } from "./construkted";
import { validPitch } from "./validPitch";

const rayScratch = new Ray();

// this mean person is stop
const DIRECTION_NONE = -1;

const DIRECTION_FORWARD = 0;
const DIRECTION_BACKWARD = 1;
const DIRECTION_LEFT = 2;
const DIRECTION_RIGHT = 3;

const DEFAULT_WALKING_SPEED = 0.5;
const COLLISION_RAY_HEIGHT = 0.5;
const HUMAN_EYE_HEIGHT = 1.65;

const scratchDirection = new Cartesian3();
const slopeToleranceForStart = 40;

interface CesiumFPVCameraControllerConstructorOptions extends CesiumCameraControllerConstructorOptions {
    defaultCameraPositionOrientationJson: any;
    ignoreCollisionDetection: boolean;
    immersiveArEnabled: boolean;
}

class CesiumFPVCameraController extends CesiumCameraController {
    private _FPVStarted: Event;
    private _FPVFinished: Event;
    private _direction: number;
    private _defaultCameraPositionOrientationJson: any;

    private _frameMonitor: FrameRateMonitor;
    private _ignoreCollisionDetection: boolean;

    private _lastTranslationX: number;
    private _lastTranslationY: number;
    private _lastTranslationZ: number;
    private _lastRotationX: number;
    private _lastRotationY: number;
    private _lastRotationZ: number;

    private _walkingSpeed: number;
    private _immersiveArEnabled: boolean;
    private _isCheckingStart: boolean;
    private _canStart: boolean;

    private _pointCollection: PointPrimitiveCollection;
    private _point: PointPrimitive;

    private _labelCollection: LabelCollection;
    private _label: Label;

    private _cameraPositionAtArStartedMoment: Cartesian3 | undefined;
    private _cameraRightAtArStartedMoment: Cartesian3 | undefined;
    private _cameraUpAtArStartedMoment: Cartesian3 | undefined;
    private _cameraDirectionAtArStartedMoment: Cartesian3 | undefined;
    private _cameraHeadingAtArStartedMoment: number = 0;
    private _cameraPitchAtArStartedMoment: number = 0;

    private _disconectOnClockTick: Event.RemoveCallback | undefined;

    private _onKeyDownCallback: (event: KeyboardEvent) => void;

    private _onKeyUpCallback: (event: KeyboardEvent) => void;

    constructor(options: CesiumFPVCameraControllerConstructorOptions) {
        super(options);

        this._FPVStarted = new Event();
        this._FPVFinished = new Event();

        this._direction = DIRECTION_NONE;

        this._defaultCameraPositionOrientationJson = options.defaultCameraPositionOrientationJson;
        this._ignoreCollisionDetection = defined(options.ignoreCollisionDetection)
            ? options.ignoreCollisionDetection
            : false;

        this._frameMonitor = FrameRateMonitor.fromScene(this._cesiumViewer.scene);

        this._lastTranslationX = 0;
        this._lastTranslationY = 0;
        this._lastTranslationZ = 0;

        this._lastRotationX = 0;
        this._lastRotationY = 0;
        this._lastRotationZ = 0;

        this._allowStartPositionTap = false;
        this._walkingSpeed = DEFAULT_WALKING_SPEED;

        // this flag has meaning on mobile device
        this._immersiveArEnabled = options.immersiveArEnabled;

        this._isCheckingStart = false;
        this._canStart = false;

        this._screenSpaceEventHandler.setInputAction(this._onMouseMove.bind(this), ScreenSpaceEventType.MOUSE_MOVE);

        const scene = this._cesiumViewer.scene;

        const primitiveCollection = new PrimitiveCollection();

        // @ts-ignore
        primitiveCollection.id = "CesiumFPVCameraController-PrimitiveCollection";

        scene.primitives.add(primitiveCollection);

        this._pointCollection = primitiveCollection.add(new PointPrimitiveCollection());
        this._labelCollection = primitiveCollection.add(new LabelCollection());

        this._point = this._pointCollection.add({
            pixelSize: 15,
            position: new Cartesian3(),
            disableDepthTestDistance: Number.POSITIVE_INFINITY, // for draw-over
            show: false
        });

        this._label = this._labelCollection.add({
            show: false,
            font: "24px Helvetica",
            scale: 1.0,
            fillColor: Color.WHITE,
            horizontalOrigin: HorizontalOrigin.CENTER,
            verticalOrigin: VerticalOrigin.CENTER,
            pixelOffset: new Cartesian2(0, -20),
            disableDepthTestDistance: Number.POSITIVE_INFINITY, // for draw-over
            position: new Cartesian3(),
            outlineColor: Color.BLACK,
            outlineWidth: 2,
            style: LabelStyle.FILL_AND_OUTLINE
        });

        const self = this;

        this._onKeyDownCallback = function (event: KeyboardEvent) {
            self._onKeyDown(event);
        };

        this._onKeyUpCallback = function () {
            self._onKeyUp();
        };
    }

    setAllowStartPositionTap(value: boolean) {
        this._allowStartPositionTap = value;
    }

    _connectEventHandlers() {
        const canvas = this._cesiumViewer.canvas;

        // needed to put focus on the canvas
        canvas.setAttribute("tabindex", "0");

        canvas.onclick = function () {
            canvas.focus();
        };

        document.addEventListener("keydown", this._onKeyDownCallback);
        document.addEventListener("keyup", this._onKeyUpCallback);

        this._disconectOnClockTick = this._cesiumViewer.clock.onTick.addEventListener(
            CesiumFPVCameraController.prototype._onClockTick,
            this
        );
    }

    _disconnectEventHandlers() {
        document.removeEventListener("keydown", this._onKeyDownCallback);
        document.removeEventListener("keyup", this._onKeyUpCallback);

        if (this._disconectOnClockTick) {
            this._disconectOnClockTick();
        }
    }

    _doStartFPV(cartographic: Cartographic) {
        this._isCheckingStart = false;
        this._canStart = false;
        this._point.show = false;
        this._label.show = false;

        const globe = this._cesiumViewer.scene.globe;
        const self = this;

        this._camera.flyTo({
            destination: globe.ellipsoid.cartographicToCartesian(cartographic),
            orientation: {
                heading: this._camera.heading,
                pitch: 0,
                roll: 0.0
            },
            complete: function () {
                disableDefaultScreenSpaceCameraController(self._cesiumViewer.scene);
                self._connectEventHandlers();

                // please note the clone 's meaning.
                self._cameraDirectionAtArStartedMoment = self._camera.direction.clone();
                self._cameraRightAtArStartedMoment = self._camera.right.clone();
                self._cameraUpAtArStartedMoment = self._camera.up.clone();
                self._cameraPositionAtArStartedMoment = self._camera.position.clone();
                self._cameraHeadingAtArStartedMoment = self._camera.heading;
                self._cameraPitchAtArStartedMoment = self._camera.pitch;

                self._FPVStarted.raiseEvent();
                self._enabled = true;
            }
        });
    }

    exitFPV() {
        enableDefaultScreenSpaceCameraController(this._cesiumViewer.scene);
        this._disconnectEventHandlers();
        this._startFPVPositionMobile = undefined;
        this._allowStartPositionTap = false;
        this._FPVFinished.raiseEvent();
        this._enabled = false;
    }

    _onKeyDown(event: KeyboardEvent) {
        if (event.shiftKey) {
            this.speed = 3.0;
        } else {
            this.speed = 1.0;
        }

        const keyCode = event.keyCode;

        this._direction = DIRECTION_NONE;

        switch (keyCode) {
            case "W".charCodeAt(0):
            case 38: // up arrow
                this._direction = DIRECTION_FORWARD;
                return;
            case "S".charCodeAt(0):
            case 40: // down arrow
                this._direction = DIRECTION_BACKWARD;
                return;
            case "D".charCodeAt(0):
            case 39: // right arrow
                this._direction = DIRECTION_RIGHT;
                return;
            case "A".charCodeAt(0):
            case 37: // left arrow
                this._direction = DIRECTION_LEFT;
                break;
            default:
        }
    }

    // noinspection JSUnusedLocalSymbols
    _onKeyUp() {
        this._direction = DIRECTION_NONE;
    }

    _getPickedPositionOnThe3DTile(screenPosition: Cartesian2) {
        // eslint-disable-next-line
        if (this._isMobile) {
            Cartesian2.clone(this._lastTapedPosition!, screenPosition);
        }

        const scene = this._cesiumViewer.scene;

        const pickedObjects = scene.drillPick(screenPosition, 2, 1, 1);

        if (!defined(pickedObjects)) {
            return null;
        }

        if (pickedObjects.length === 0) {
            return null;
        }

        let found3DTiles = false;

        pickedObjects.forEach((pickedObject) => {
            if (pickedObject && pickedObject.primitive && pickedObject.primitive instanceof Cesium3DTileset) {
                found3DTiles = true;
            }
        });

        if (!found3DTiles) {
            return null;
        }

        const pickRay = scene.camera.getPickRay(screenPosition, rayScratch);
        // @ts-ignore
        const result = scene.pickFromRay(pickRay, [this._point, this._label]);

        if (!result) {
            console.warn("pickFromRay failed!");
            return null;
        }

        return result.position;
    }

    _getPickedCartographicOnThe3DTile(screenPosition: Cartesian2) {
        const position = this._getPickedPositionOnThe3DTile(screenPosition);

        if (!position) return null;

        const globe = this._cesiumViewer.scene.globe;

        const pickedCartographic = globe.ellipsoid.cartesianToCartographic(position);

        // check if user click the inside of 3d tile.
        // first we get the height value from clicked window position(pickedCartographic.height) which may different from the terrain height when user click the 3d tile
        // next we get the real terran height for clicked window position(terrainHeightAtPickedCartographic).
        // then compare it.

        // if globe is not shown, we do not need to perform this logic.

        if (globe.show) {
            // consider terrain height
            const terrainHeightAtPickedCartographic = globe.getHeight(pickedCartographic);

            if (terrainHeightAtPickedCartographic === undefined) {
                console.warn("globe.getHeight(cartographic) failed!");
                return null;
            }

            // determine if we clicked out of main 3d tileset
            if (
                CesiumMath.equalsEpsilon(
                    pickedCartographic.height,
                    terrainHeightAtPickedCartographic,
                    CesiumMath.EPSILON4,
                    CesiumMath.EPSILON1
                )
            ) {
                console.warn("out of 3d tile!");

                return null;
            }
        }

        // Cesium createWorldTerrain provider gives negative height value on some places
        if (pickedCartographic.height < 0) {
            console.warn("height is negative");
        }

        pickedCartographic.height += HUMAN_EYE_HEIGHT;

        return pickedCartographic;
    }

    _onMouseLButtonDoubleClicked(movement: { position: Cartesian2 }) {
        const pickedCartographic = this._getPickedCartographicOnThe3DTile(movement.position);

        /**
         * FPV was already started
         * In this case we fly to double clicked(taped) position
         */

        if (this._enabled) {
            // get clicked(taped) position

            if (!pickedCartographic) return;

            const globe = this._cesiumViewer.scene.globe;

            this._camera.flyTo({
                destination: globe.ellipsoid.cartographicToCartesian(pickedCartographic),
                orientation: {
                    heading: this._camera.heading,
                    pitch: 0,
                    roll: 0.0
                }
            });

            return;
        }

        // FPV is not yet started so check whether or not we can start FPV
        // user can't start FPV until he clicks FPV button on the user interface.
        if (!this._canStart) {
            return;
        }

        // we can directly start FPV

        if (!pickedCartographic) {
            alert("Unfortunately failed to enter FPV!");
            return;
        }

        this._doStartFPV(pickedCartographic);
    }

    _onMouseMove(movement: { endPosition: Cartesian2 }) {
        if (this._enabled && this._leftButtonPressed) {
            this._changeCameraHeadingPitch(movement.endPosition);
            return;
        }

        if (this._isCheckingStart) {
            const position = this._getPickedPositionOnThe3DTile(movement.endPosition);

            if (!defined(position)) {
                console.warn("failed to get position");
                return;
            }

            let slope = getSlope(this._cesiumViewer.scene, movement.endPosition);

            if (!defined(slope)) {
                console.warn("failed to get slope");
                return;
            }

            slope = CesiumMath.toDegrees(slope);

            this._point.position = position;
            this._label.position = position;
            this._point.show = true;
            this._label.show = true;

            if (slope < slopeToleranceForStart) {
                this._point.color = Color.GREEN;
                this._label.text = "Double Click to start";

                this._canStart = true;
            } else {
                console.warn("can not start: slope: ", slope);

                this._point.color = Color.RED.withAlpha(0.5);
                this._label.text = "Cannot start FPV from that location";
                this._canStart = false;
            }
        }
    }

    _getCurrentCameraPositionAtCollisionHeight() {
        const currentCameraPosition = this._camera.position;

        const magnitude = Cartesian3.magnitude(currentCameraPosition);
        const scalar = (magnitude - HUMAN_EYE_HEIGHT + COLLISION_RAY_HEIGHT) / magnitude;

        return Cartesian3.multiplyByScalar(currentCameraPosition, scalar, new Cartesian3());
    }

    _getRayPosition() {
        const currentCameraPosition = this._camera.position;

        const magnitude = Cartesian3.magnitude(currentCameraPosition);
        const scalar = (magnitude - HUMAN_EYE_HEIGHT + COLLISION_RAY_HEIGHT) / magnitude;

        const ret = new Cartesian3();

        return Cartesian3.multiplyByScalar(currentCameraPosition, scalar, ret);
    }

    _changeCameraPosition(dt: number) {
        if (this._direction === DIRECTION_FORWARD)
            Cartesian3.multiplyByScalar(this._camera.direction, 1, scratchDirection);
        else if (this._direction === DIRECTION_BACKWARD)
            Cartesian3.multiplyByScalar(this._camera.direction, -1, scratchDirection);
        else if (this._direction === DIRECTION_LEFT)
            Cartesian3.multiplyByScalar(this._camera.right, -1, scratchDirection);
        else if (this._direction === DIRECTION_RIGHT)
            Cartesian3.multiplyByScalar(this._camera.right, 1, scratchDirection);

        const stepDistance = this._fpsConsideredWalkingSpeed() * this.speed * dt;

        const deltaPosition = Cartesian3.multiplyByScalar(scratchDirection, stepDistance, new Cartesian3());

        const rayPosition = this._getRayPosition();

        const endPosition = Cartesian3.add(rayPosition, deltaPosition, new Cartesian3());

        const rayDirection = Cartesian3.normalize(
            Cartesian3.subtract(endPosition, rayPosition, new Cartesian3()),
            new Cartesian3()
        );

        const ray = new Ray(rayPosition, rayDirection);

        // @ts-ignore
        const result = this._cesiumViewer.scene.pickFromRay(ray);

        if (defined(result)) {
            const distanceToIntersection = Cartesian3.distanceSquared(rayPosition, result.position);

            if (distanceToIntersection > stepDistance) {
                this._setCameraPosition(endPosition);
                return;
            }

            return;
        }

        this._setCameraPosition(endPosition);
    }

    _setCameraPosition(position: Cartesian3) {
        const globe = this._cesiumViewer.scene.globe;
        const ellipsoid = globe.ellipsoid;

        const cartographic = ellipsoid.cartesianToCartographic(position);

        cartographic.height = 0;

        const sampledHeight = this._cesiumViewer.scene.sampleHeight(cartographic);

        const currentCameraCartographic = ellipsoid.cartesianToCartographic(this._camera.position);

        if (sampledHeight === undefined) {
            console.warn("sampled height is undefined");
            return;
        }

        // Cesium createWorldTerrain provider gives negative height value on some places
        if (sampledHeight < 0) {
            console.warn("sampled height is negative");
        }

        if (sampledHeight > currentCameraCartographic.height) cartographic.height = currentCameraCartographic.height;
        else {
            cartographic.height = sampledHeight + HUMAN_EYE_HEIGHT;
        }

        this._camera.setView({
            destination: ellipsoid.cartographicToCartesian(cartographic),
            orientation: new HeadingPitchRoll(this._camera.heading, this._camera.pitch, this._camera.roll),
            endTransform: Matrix4.IDENTITY
        });
    }

    // check collision

    _canMove(startPosition: Cartesian3, endPosition: Cartesian3, stepDistance: number) {
        /**
         * code snippet to reconsider
         */

        /*
         const scene = this._cesiumViewer.scene;
         const globe = scene.globe;
         const ellipsoid = globe.ellipsoid;

         const startCartographic = ellipsoid.cartesianToCartographic(startPosition);
         const endCartographic = ellipsoid.cartesianToCartographic(endPosition);

         const startHeight =  scene.sampleHeight(startCartographic);
         const endHeight =  scene.sampleHeight(endCartographic);

         const deltaHeight = endHeight - startHeight;

         if(deltaHeight > 0.5)
         {
         console.warn('can not move 0.5 m higher position!');
         return false;
         }

         */

        if (this._ignoreCollisionDetection) return true;

        const rayDirection = Cartesian3.subtract(endPosition, startPosition, new Cartesian3());

        const ray = new Ray(startPosition, rayDirection);

        // @ts-ignore horizontal pick
        const result = this._cesiumViewer.scene.pickFromRay(ray);

        if (defined(result)) {
            // check collision
            const distanceToIntersection = Cartesian3.distanceSquared(startPosition, result.position);

            if (distanceToIntersection >= stepDistance) {
                // we can safely move to endPosition
                return true;
            }
            // in future please consider vertical height difference
            return false;
        }
        return true;
    }

    _getRevisedCameraPosition(targetPosition: Cartesian3) {
        const scene = this._cesiumViewer.scene;
        const globe = scene.globe;
        const ellipsoid = globe.ellipsoid;

        const targetCartographic = ellipsoid.cartesianToCartographic(targetPosition);

        const heightAtTargetPosition = scene.sampleHeight(targetCartographic);

        const currentCameraCartographic = ellipsoid.cartesianToCartographic(this._camera.position);

        // console.log('heightAtTargetPosition: ' + heightAtTargetPosition);
        // console.log('current camera height: ' + currentCameraCartographic.height);

        if (heightAtTargetPosition === undefined) {
            console.warn("heightAtTargetPosition is undefined");
            /**
             *  in future we need to think why heightAtTargetPosition is undefined
             */

            // return null;

            targetCartographic.height = currentCameraCartographic.height;
            return ellipsoid.cartographicToCartesian(targetCartographic);
        }

        if (heightAtTargetPosition < 0) {
            /**
             *  in future we need to think why heightAtTargetPosition is negative
             */

            console.warn("heightAtTargetPosition is negative");
            // return null;

            targetCartographic.height = currentCameraCartographic.height;
            return ellipsoid.cartographicToCartesian(targetCartographic);
        }

        if (heightAtTargetPosition > currentCameraCartographic.height) {
            /**
             * code snippet to reconsider
             */
            targetCartographic.height = currentCameraCartographic.height;
        } else {
            targetCartographic.height = heightAtTargetPosition + HUMAN_EYE_HEIGHT;
        }

        return ellipsoid.cartographicToCartesian(targetCartographic);
    }

    _onClockTick(clock: Clock) {
        const dt = clock.clockStep;

        if (this._direction !== DIRECTION_NONE) {
            this._changeCameraPosition(dt);
        }
    }

    started() {
        return this._enabled;
    }

    getViewData() {
        const camera = this._cesiumViewer.camera;

        const cartographic = this._cesiumViewer.scene.globe.ellipsoid.cartesianToCartographic(camera.position);

        const viewData = {
            longitude: cartographic.longitude,
            latitude: cartographic.latitude,
            height: cartographic.height,
            heading: camera.heading,
            pitch: camera.pitch,
            roll: camera.roll
        };

        return JSON.stringify(viewData);
    }

    _fpsConsideredWalkingSpeed() {
        const lastFPS = this._frameMonitor.lastFramesPerSecond;

        const defaultWorkingSpeed = this._walkingSpeed;

        if (lastFPS === undefined) {
            return defaultWorkingSpeed;
        }

        const factor = 30;

        return (defaultWorkingSpeed * factor) / lastFPS;
    }

    FPVStarted() {
        return this._FPVStarted;
    }

    FPVFinished() {
        return this._FPVFinished;
    }

    startFPVMobile() {
        const pickedCartographic = this._getPickedCartographicOnThe3DTile(this._startFPVPositionMobile!);

        if (pickedCartographic) {
            this._doStartFPV(pickedCartographic);
        }
    }

    _getModifiedCurrentCameraPositionMobile() {
        const currentCameraPosition = this._cameraPositionAtArStartedMoment!;

        const magnitude = Cartesian3.magnitude(currentCameraPosition);
        const scalar = (magnitude - HUMAN_EYE_HEIGHT + COLLISION_RAY_HEIGHT) / magnitude;

        return Cartesian3.multiplyByScalar(currentCameraPosition, scalar, new Cartesian3());
    }

    setView(
        translationX: number,
        translationY: number,
        translationZ: number,
        rotationX: number,
        rotationY: number,
        rotationZ: number
    ) {
        if (
            translationX === this._lastTranslationX &&
            translationZ === this._lastTranslationZ &&
            rotationX === this._lastRotationX &&
            rotationY === this._lastRotationY
        )
            return;

        let cameraPosition;

        const right = Cartesian3.multiplyByScalar(this._cameraRightAtArStartedMoment!, translationX, new Cartesian3());
        const direction = Cartesian3.multiplyByScalar(
            this._cameraDirectionAtArStartedMoment!,
            -translationZ,
            new Cartesian3()
        );

        const deltaPosition = Cartesian3.add(right, direction, new Cartesian3());

        // we ignore up movement
        // deltaPosition = Cartesian3.add(deltaPosition, up, new Cartesian3());

        if (deltaPosition.equals(Cartesian3.ZERO)) {
            cameraPosition = this._cameraPositionAtArStartedMoment!.clone();
        } else {
            const startPosition = this._getModifiedCurrentCameraPositionMobile();

            const endPosition = Cartesian3.add(startPosition, deltaPosition, new Cartesian3());

            if (!this._canMove(startPosition, endPosition, Cartesian3.magnitude(deltaPosition))) {
                console.warn("collision detected. can not move!");
                cameraPosition = this._cameraPositionAtArStartedMoment!.clone();
            } else {
                cameraPosition = this._getRevisedCameraPosition(endPosition);
            }
        }

        // change orientation

        const originalHeadingInDegree = CesiumMath.toDegrees(this._cameraHeadingAtArStartedMoment);
        const newHeadingInDegree = originalHeadingInDegree + rotationX;

        const originalPitchInDegree = CesiumMath.toDegrees(this._cameraPitchAtArStartedMoment);
        let newPitchInDegree = originalPitchInDegree + rotationY;

        newPitchInDegree = validPitch(newPitchInDegree);

        // we ignore roll
        this._camera.setView({
            destination: cameraPosition,
            orientation: {
                heading: CesiumMath.toRadians(newHeadingInDegree),
                pitch: CesiumMath.toRadians(newPitchInDegree),
                roll: this._camera.roll
            },
            endTransform: Matrix4.IDENTITY
        });

        this._lastTranslationX = translationX;
        this._lastTranslationY = translationY;
        this._lastTranslationZ = translationZ;

        this._lastRotationX = rotationX;
        this._lastRotationY = rotationY;
        this._lastRotationZ = rotationZ;
    }

    startFPVPositionMobile() {
        return this._startFPVPositionMobile;
    }

    setDirectionLeft() {
        this._direction = DIRECTION_LEFT;
    }

    setDirectionRight() {
        this._direction = DIRECTION_RIGHT;
    }

    setDirectionForward() {
        this._direction = DIRECTION_FORWARD;
    }

    setDirectionBackward() {
        this._direction = DIRECTION_BACKWARD;
    }

    setDirectionNone() {
        this._direction = DIRECTION_NONE;
    }

    onDoubleTaped(movement: { position: Cartesian2 }) {
        this._onMouseLButtonDoubleClicked(movement);
    }

    setWorkingSpeed(speed: number) {
        this._walkingSpeed = speed;
    }

    setImmersiveArEnabled(b: boolean) {
        this._immersiveArEnabled = b;
    }

    setAllowCheckingStart(b: boolean) {
        this._point.show = b;
        this._label.show = b;
        this._isCheckingStart = b;
    }
}

export { CesiumFPVCameraController };
