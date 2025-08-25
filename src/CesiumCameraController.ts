/* qeslint-disable */
// q@ts-nocheck

import { Camera, Cartesian2, Math as CesiumMath, ScreenSpaceEventHandler, ScreenSpaceEventType, Viewer } from "cesium";
import { validPitch } from "./validPitch";

const CAMERA_ANGLE_CHANGE_SPEED_HEADING = -60;
const CAMERA_ANGLE_CHANGE_SPEED_PITCH = -35;

export interface CesiumCameraControllerConstructorOptions {
    isMobile: boolean;
    cesiumViewer: Viewer;
}

class CesiumCameraController {
    protected _isMobile: boolean;
    protected _enabled: boolean;
    protected _allowStartPositionTap: boolean;
    protected _cesiumViewer: Viewer;
    protected _canvas: HTMLCanvasElement;
    protected _camera: Camera;
    private _speed: number;
    protected _leftButtonPressed: boolean;
    private _cameraHeadingWhenLbuttonPressed: number;
    private _cameraPitchWhenLbuttonPressed: number;
    private _startMousePosition: Cartesian2 = new Cartesian2();
    protected _lastTapedPosition: Cartesian2 | undefined;
    protected _startFPVPositionMobile: Cartesian2 | undefined;
    protected _screenSpaceEventHandler: ScreenSpaceEventHandler;

    constructor(options: CesiumCameraControllerConstructorOptions) {
        this._isMobile = options.isMobile;
        this._enabled = false;

        this._cesiumViewer = options.cesiumViewer;
        this._canvas = this._cesiumViewer.canvas;
        this._camera = this._cesiumViewer.camera;
        this._speed = 1.0;

        /**
         * heading: angle with up direction
         * pitch:   angle with right direction
         * roll:    angle with look at direction
         */

        // indicate if heading and pitch is changed
        this._leftButtonPressed = false;
        this._cameraHeadingWhenLbuttonPressed = this._camera.heading;
        this._cameraPitchWhenLbuttonPressed = this._camera.pitch;

        this._screenSpaceEventHandler = new ScreenSpaceEventHandler(this._canvas);

        this._screenSpaceEventHandler.setInputAction(
            this._onMouseLButtonDoubleClicked.bind(this),
            ScreenSpaceEventType.LEFT_DOUBLE_CLICK
        );
        this._screenSpaceEventHandler.setInputAction(
            this._onMouseLButtonClicked.bind(this),
            ScreenSpaceEventType.LEFT_DOWN
        );

        // this._screenSpaceEventHandler.setInputAction(this._onMouseMove.bind(this), ScreenSpaceEventType.MOUSE_MOVE);

        this._screenSpaceEventHandler.setInputAction(this._onMouseUp.bind(this), ScreenSpaceEventType.LEFT_UP);
        this._allowStartPositionTap = false;
    }

    // need to override
    // eslint-disable-next-line class-methods-use-this, no-unused-vars, @typescript-eslint/no-unused-vars
    _onMouseMove(movement: { endPosition: Cartesian2 }) {}

    // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars
    _onMouseLButtonDoubleClicked(movement: { position: Cartesian2 }) {}

    _onMouseLButtonClicked(movement: { position: Cartesian2 }) {
        if (this._isMobile) this._lastTapedPosition = movement.position;

        if (!this._startFPVPositionMobile) {
            if (this._allowStartPositionTap) this._startFPVPositionMobile = movement.position.clone();
        }

        this._leftButtonPressed = true;
        this._cameraHeadingWhenLbuttonPressed = this._camera.heading;
        this._cameraPitchWhenLbuttonPressed = this._camera.pitch;
        Cartesian2.clone(movement.position, this._startMousePosition);
    }

    _onMouseUp() {
        this._leftButtonPressed = false;
    }

    _changeCameraHeadingPitch(currentMousePosition: Cartesian2) {
        const width = this._canvas.clientWidth;
        const height = this._canvas.clientHeight;

        const deltaX = (currentMousePosition.x - this._startMousePosition.x) / width;
        const deltaY = -(currentMousePosition.y - this._startMousePosition.y) / height;

        const deltaHeadingInDegree = deltaX * CAMERA_ANGLE_CHANGE_SPEED_HEADING;
        const deltaPitchInDegree = deltaY * CAMERA_ANGLE_CHANGE_SPEED_PITCH;

        this._camera.setView({
            orientation: {
                heading: this._cameraHeadingWhenLbuttonPressed + CesiumMath.toRadians(deltaHeadingInDegree),
                pitch: validPitch(this._cameraPitchWhenLbuttonPressed + CesiumMath.toRadians(deltaPitchInDegree)),
                roll: this._camera.roll
            }
        });
    }

    get speed() {
        return this._speed;
    }

    set speed(value) {
        this._speed = value;
    }
}

export { CesiumCameraController };
