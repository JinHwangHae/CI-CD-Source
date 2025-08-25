/* qeslint-disable */
// q@ts-nocheck

import { Cartesian3, DeveloperError, Viewer } from "cesium";
import { MouseButton, MouseEvent, MapTool } from "../core";
import { EditablePolygon } from "./annotation/EditablePolygon";

const cart3Scratch = new Cartesian3();

export class PolygonEditTool extends MapTool {
    private _polygon: EditablePolygon | undefined;
    private _selectedPrimitive: any;

    constructor(options: { viewer: Viewer }) {
        super({
            name: "PolygonEditTool",
            viewer: options.viewer
        });
    }

    get polygon() {
        if (!this._polygon) {
            throw new DeveloperError("error");
        }

        return this._polygon;
    }

    activate(activateOptions: { polygon: EditablePolygon }): void {
        super.activate(activateOptions);

        this._polygon = activateOptions.polygon;

        this._polygon.startEditing();
    }

    deactivate(deactivateOptions: { normallyDeactivate: boolean }): void {
        super.deactivate(deactivateOptions);

        if (deactivateOptions && deactivateOptions.normallyDeactivate) {
            this.polygon.restoreMainVertices();
            this.polygon.removeMiddleVertices();
        } else {
            this.polygon.revertToOriginal();
        }

        this._polygon = undefined;
    }

    canvasPressEvent(event: MouseEvent): void {
        const pickedPrimitive = this.pickPrimitive(event.pos);

        if (!pickedPrimitive) {
            this._selectedPrimitive = undefined;
            return;
        }

        const index = this.polygon.indexOfMiddleVertices(pickedPrimitive);

        if (index !== -1) {
            this._selectedPrimitive = this.polygon.insertMainVertex(index);
        } else if (this.polygon.indexOfMainVertices(pickedPrimitive) !== -1) {
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

        const index = this.polygon.indexOfMainVertices(this._selectedPrimitive);

        if (index !== -1) {
            this.polygon.updateMainVertex(index, position);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    canvasReleaseEvent(event: MouseEvent): void {
        this._selectedPrimitive = undefined;
        const scene = this._viewer.scene;
        scene.screenSpaceCameraController.enableRotate = true;
    }

    canvasDoubleClickEvent(event: MouseEvent): void {
        const pickedPointPrimitive = this.pickPrimitive(event.pos);

        if (!pickedPointPrimitive) {
            this._selectedPrimitive = undefined;
            return;
        }

        const index = this.polygon.indexOfMainVertices(pickedPointPrimitive);

        if (index === -1) {
            return;
        }

        if (this._polygon!.polygonPrimitive.positions.length < 4) {
            return;
        }

        this.polygon.removeMainVertex(index);
    }
}
