/* qeslint-disable */
// q@ts-nocheck

/*
 sandcastle sample

 https://sandcastle.cesium.com/?src=Camera%20Tutorial.html
*/

import { Cartesian2, ScreenSpaceEventType } from "cesium";
import { CesiumCameraController, CesiumCameraControllerConstructorOptions } from "./CesiumCameraController";
import { disableDefaultScreenSpaceCameraController, enableDefaultScreenSpaceCameraController } from "./construkted";

function getFlagForKeyCode(keyCode: number) {
    switch (keyCode) {
        case "W".charCodeAt(0):
            return "moveForward";
        case "S".charCodeAt(0):
            return "moveBackward";
        case "R".charCodeAt(0):
            return "moveUp";
        case "F".charCodeAt(0):
            return "moveDown";
        case "D".charCodeAt(0):
            return "moveRight";
        case "A".charCodeAt(0):
            return "moveLeft";
        default:
            return undefined;
    }
}

const flags = {
    moveForward: false,
    moveBackward: false,
    moveUp: false,
    moveDown: false,
    moveLeft: false,
    moveRight: false
};

const defaultFLYSpeed = 2;

const testOnLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

interface CesiumFLYCameraControllerConstructorOptions extends CesiumCameraControllerConstructorOptions {}

class CesiumFLYCameraController extends CesiumCameraController {
    private _started: boolean;
    private _moveRateFactor: number;
    constructor(options: CesiumFLYCameraControllerConstructorOptions) {
        super(options);

        this._started = false;
        this._moveRateFactor = 0.4;

        const self = this;

        document.addEventListener(
            "keydown",
            (e) => {
                if (e.shiftKey) self.speed = 3;
                else self.speed = 1;

                const flagName = getFlagForKeyCode(e.keyCode);

                if (typeof flagName !== "undefined") {
                    flags[flagName] = true;
                }
            },
            false
        );

        document.addEventListener(
            "keyup",
            (e) => {
                const flagName = getFlagForKeyCode(e.keyCode);
                if (typeof flagName !== "undefined") {
                    flags[flagName] = false;
                }
            },
            false
        );

        if (!testOnLocal && !window.location.pathname.includes("embed")) {
            // document.getElementById("fly-up").addEventListener("touchstart", );

            ["touchstart", "mousedown"].forEach((evt) =>
                document.getElementById("fly-up")!.addEventListener(evt, () => {
                    flags.moveUp = true;
                })
            );

            ["touchend", "mouseup"].forEach((evt) =>
                document.getElementById("fly-up")!.addEventListener(evt, () => {
                    flags.moveUp = false;
                })
            );

            ["touchstart", "mousedown"].forEach((evt) =>
                document.getElementById("fly-down")!.addEventListener(evt, () => {
                    flags.moveDown = true;
                })
            );

            ["touchend", "mouseup"].forEach((evt) =>
                document.getElementById("fly-down")!.addEventListener(evt, () => {
                    flags.moveDown = false;
                })
            );

            ["touchstart", "mousedown"].forEach((evt) =>
                document.getElementById("fly-forward")!.addEventListener(evt, () => {
                    flags.moveForward = true;
                })
            );

            ["touchend", "mouseup"].forEach((evt) =>
                document.getElementById("fly-forward")!.addEventListener(evt, () => {
                    flags.moveForward = false;
                })
            );

            ["touchstart", "mousedown"].forEach((evt) =>
                document.getElementById("fly-back")!.addEventListener(evt, () => {
                    flags.moveBackward = true;
                })
            );

            ["touchend", "mouseup"].forEach((evt) =>
                document.getElementById("fly-back")!.addEventListener(evt, () => {
                    flags.moveBackward = false;
                })
            );

            ["touchstart", "mousedown"].forEach((evt) =>
                document.getElementById("fly-left")!.addEventListener(evt, () => {
                    flags.moveLeft = true;
                })
            );

            ["touchend", "mouseup"].forEach((evt) =>
                document.getElementById("fly-left")!.addEventListener(evt, () => {
                    flags.moveLeft = false;
                })
            );

            ["touchstart", "mousedown"].forEach((evt) =>
                document.getElementById("fly-right")!.addEventListener(evt, () => {
                    flags.moveRight = true;
                })
            );

            ["touchend", "mouseup"].forEach((evt) =>
                document.getElementById("fly-right")!.addEventListener(evt, () => {
                    flags.moveRight = false;
                })
            );
        }

        const viewer = this._cesiumViewer;
        const canvas = viewer.canvas;

        canvas.setAttribute("tabindex", "0"); // needed to put focus on the canvas
        canvas.onclick = function () {
            canvas.focus();
        };

        viewer.clock.onTick.addEventListener(() => {
            if (!this._started) return;

            const camera = viewer.camera;

            const moveRate = defaultFLYSpeed * this._moveRateFactor * this.speed;

            if (flags.moveForward) {
                camera.moveForward(moveRate);
            }
            if (flags.moveBackward) {
                camera.moveBackward(moveRate);
            }
            if (flags.moveUp) {
                // @ts-ignore
                camera.moveUpEx(moveRate);
            }
            if (flags.moveDown) {
                // @ts-ignore
                camera.moveDownEx(moveRate);
            }
            if (flags.moveLeft) {
                camera.moveLeft(moveRate);
            }
            if (flags.moveRight) {
                camera.moveRight(moveRate);
            }
        });
    }

    start() {
        disableDefaultScreenSpaceCameraController(this._cesiumViewer.scene);
        this._started = true;

        this._screenSpaceEventHandler.setInputAction(this._onMouseMove.bind(this), ScreenSpaceEventType.MOUSE_MOVE);
    }

    stop() {
        enableDefaultScreenSpaceCameraController(this._cesiumViewer.scene);
        this._started = false;

        this._screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);
    }

    _onMouseMove(movement: { endPosition: Cartesian2 }) {
        if (!this._leftButtonPressed) return;

        this._changeCameraHeadingPitch(movement.endPosition);
    }

    started() {
        return this._started;
    }

    setMoveRateFactor(n: number) {
        this._moveRateFactor = n;
    }
}

export { CesiumFLYCameraController };
