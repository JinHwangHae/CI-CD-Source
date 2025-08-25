/* qeslint-disable */
// q@ts-nocheck

import { Cartesian3, DeveloperError, Viewer } from "cesium";
import { MouseButton, MouseEvent, MapTool } from "../core";
import { EditablePolyline } from "./annotation/EditablePolyline";

const cart3Scratch = new Cartesian3();

export class PolylineEditTool extends MapTool {
    private _polyline: EditablePolyline | undefined;
    private _selectedPrimitive: any;

    constructor(options: { viewer: Viewer }) {
        super({
            name: "PolylineEditTool",
            viewer: options.viewer
        });
    }

    get polyline() {
        if (!this._polyline) {
            throw new DeveloperError("error");
        }

        return this._polyline;
    }

    activate(activateOptions: { polyline: EditablePolyline }): void {
        super.activate(activateOptions);

        this._polyline = activateOptions.polyline;

        this._polyline.startEditing();
    }

    deactivate(deactivateOptions: { normallyDeactivate: boolean }): void {
        super.deactivate(deactivateOptions);

        if (deactivateOptions && deactivateOptions.normallyDeactivate) {
            this.polyline.restoreMainVertices();
            this.polyline.removeMiddleVertices();
        } else {
            this.polyline.revertToOriginal();
        }

        this._polyline = undefined;
    }

    canvasPressEvent(event: MouseEvent): void {
        const pickedPrimitive = this.pickPrimitive(event.pos);

        if (!pickedPrimitive) {
            this._selectedPrimitive = undefined;
            return;
        }

        const index = this.polyline.indexOfMiddleVertices(pickedPrimitive);

        if (index !== -1) {
            this._selectedPrimitive = this.polyline.insertMainVertex(index);
        } else if (this.polyline.indexOfMainVertices(pickedPrimitive) !== -1) {
            this._selectedPrimitive = pickedPrimitive;
        }

        if (this._selectedPrimitive) {
            const scene = this._viewer.scene;
            scene.screenSpaceCameraController.enableRotate = false;
        }
    }

    // eslint-disable-next-line class-methods-use-this
    canvasMoveEvent(event: MouseEvent) {
        if (event.button === MouseButton.LeftButton) {
            if (this._selectedPrimitive) {
                this._onDraggingSelectedPointPrimitive(event);
            }
        }
    }

    private _onDraggingSelectedPointPrimitive(event: MouseEvent) {
        const position = this.getWorldPosition(event.pos, cart3Scratch);

        if (!position) {
            return;
        }

        if (!this._selectedPrimitive) {
            throw new DeveloperError("error");
        }

        const index = this.polyline.indexOfMainVertices(this._selectedPrimitive);

        if (index !== -1) {
            this.polyline.updateMainVertex(index, position);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    canvasReleaseEvent(event: MouseEvent): void {
        this._selectedPrimitive = undefined;
        const scene = this._viewer.scene;
        scene.screenSpaceCameraController.enableRotate = true;
    }

    canvasDoubleClickEvent(event: MouseEvent): void {
        const pickedPrimitive = this.pickPrimitive(event.pos);

        if (!pickedPrimitive) {
            this._selectedPrimitive = undefined;
            return;
        }

        const index = this.polyline.indexOfMainVertices(pickedPrimitive);

        if (index === -1) {
            return;
        }

        this.polyline.removeMainVertex(index);
    }
}
