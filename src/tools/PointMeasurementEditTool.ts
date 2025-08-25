import { Viewer } from "cesium";
import { MapTool, MouseButton, MouseEvent } from "../core";
import { PointMeasurement } from "./annotation";

export class PointMeasurementEditTool extends MapTool {
    private _pointMeasurement: PointMeasurement | undefined;
    private _selected: boolean;

    constructor(options: { viewer: Viewer }) {
        super({
            name: "PointMeasurementEditTool",
            viewer: options.viewer
        });

        this._selected = false;
    }

    get pointMeasurement() {
        return this._pointMeasurement as PointMeasurement;
    }

    activate(activateOptions: { pointMeasurement: PointMeasurement }): void {
        super.activate(activateOptions);

        this._pointMeasurement = activateOptions.pointMeasurement;

        this._pointMeasurement.startEditing();
    }

    deactivate(deactivateOptions: { normallyDeactivate: boolean }): void {
        super.deactivate(deactivateOptions);

        if (deactivateOptions && deactivateOptions.normallyDeactivate) {
            this.pointMeasurement.finishEditing(false);
        } else {
            this.pointMeasurement.finishEditing(true);
        }

        this._pointMeasurement = undefined;
        this._selected = false;
    }

    canvasPressEvent(event: MouseEvent): void {
        const pickedPrimitive = this.pickPrimitive(event.pos);

        if (!pickedPrimitive) {
            return;
        }

        if (Object.is(pickedPrimitive, this._pointMeasurement?.point)) {
            this.scene.screenSpaceCameraController.enableRotate = false;
            this._selected = true;
        }
    }

    // eslint-disable-next-line class-methods-use-this
    canvasMoveEvent(event: MouseEvent) {
        if (event.button !== MouseButton.LeftButton) {
            return;
        }

        if (!this._selected) {
            return;
        }

        this._pointMeasurement?.update(event);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    canvasReleaseEvent(event: MouseEvent): void {
        const scene = this._viewer.scene;
        scene.screenSpaceCameraController.enableRotate = true;
        this._selected = false;
    }
}
