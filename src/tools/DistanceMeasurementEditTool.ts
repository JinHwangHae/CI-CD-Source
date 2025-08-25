import { Cartesian3, PointPrimitive, Viewer } from "cesium";

import { MapTool, MouseButton, MouseEvent } from "../core";

import { DistanceMeasurement } from "./annotation/measure/DistanceMeasurement";

const scratchPickedPosition = new Cartesian3();

export class DistanceMeasurementEditTool extends MapTool {
    private _distanceMeasurement: DistanceMeasurement | undefined;
    private _selectedPointPrimitive: PointPrimitive | undefined;

    constructor(options: { viewer: Viewer }) {
        super({
            name: "DistanceMeasurementEditTool",
            viewer: options.viewer
        });
    }

    activate(activateOptions: { distanceMeasurement: DistanceMeasurement }): void {
        super.activate(activateOptions);

        this._distanceMeasurement = activateOptions.distanceMeasurement;

        this._distanceMeasurement.startEditing();
    }

    deactivate(deactivateOptions: { normallyDeactivate: boolean }): void {
        super.deactivate(deactivateOptions);

        if (deactivateOptions && deactivateOptions.normallyDeactivate) {
            this._distanceMeasurement!.restorePoints();
        } else {
            this._distanceMeasurement!.revertToOriginal(this.scene);
        }

        this._distanceMeasurement = undefined;
    }

    get distanceMeasurement() {
        return this._distanceMeasurement as DistanceMeasurement;
    }

    canvasPressEvent(event: MouseEvent): void {
        const pickedPrimitive = this.pickPrimitive(event.pos);

        if (!pickedPrimitive) {
            this._selectedPointPrimitive = undefined;
            return;
        }

        if (
            Object.is(this.distanceMeasurement.startPoint, pickedPrimitive) ||
            Object.is(this.distanceMeasurement.endPoint, pickedPrimitive)
        ) {
            this._selectedPointPrimitive = pickedPrimitive;
            const scene = this._viewer.scene;
            scene.screenSpaceCameraController.enableRotate = false;
        } else {
            this._selectedPointPrimitive = undefined;
        }
    }

    canvasMoveEvent(event: MouseEvent) {
        if (event.button === MouseButton.LeftButton) {
            if (this._selectedPointPrimitive) {
                const pickedPosition = this.getWorldPosition(event.pos, scratchPickedPosition);

                if (pickedPosition) {
                    this._selectedPointPrimitive.position = pickedPosition;
                    this._distanceMeasurement?.updateByPoint(this.scene, this._selectedPointPrimitive);
                }
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    canvasReleaseEvent(event: MouseEvent): void {
        this._selectedPointPrimitive = undefined;
        const scene = this._viewer.scene;
        scene.screenSpaceCameraController.enableRotate = true;
    }
}
