import { Cartesian2, Cartesian3, Cartographic, IntersectionTests, Plane, Primitive, Ray, Viewer } from "cesium";
import { getSlopeAndAspect, MapTool, MouseButton, MouseEvent } from "../core";
import { getOffsetedPosition } from "./annotation/EditCommon";
import { NoteDrawing } from "./annotation";

const cart3Scratch = new Cartesian3();
const offsetedPositionScratch = new Cartesian3();
const rayScratch = new Ray();
const intersectScratch = new Cartesian3();
const verticalScreenPosScratch = new Cartesian2();
const planeNormalScratch = new Cartesian3();
const surfaceNormalScratch = new Cartesian3();

export class NoteEditTool extends MapTool {
    private _noteDrawing: NoteDrawing | undefined;
    private _selectedPrimitive: Primitive | undefined;
    private readonly _mousePositionWhenClicked: Cartesian2 = new Cartesian2();
    private _distanceWhenClicked = 0;
    private _verticalPlane = new Plane(Cartesian3.UNIT_X, 0);

    constructor(options: { viewer: Viewer }) {
        super({
            name: "NoteEditTool",
            viewer: options.viewer
        });
    }

    get noteDrawing() {
        return this._noteDrawing as NoteDrawing;
    }

    activate(activateOptions: { noteDrawing: NoteDrawing }): void {
        super.activate(activateOptions);

        this._noteDrawing = activateOptions.noteDrawing;

        this._noteDrawing.startEditing();
    }

    deactivate(deactivateOptions: { normallyDeactivate: boolean }): void {
        super.deactivate(deactivateOptions);

        if (deactivateOptions && deactivateOptions.normallyDeactivate) {
            this.noteDrawing.finishEditing(false);
        } else {
            this.noteDrawing.finishEditing(true);
        }

        this._noteDrawing = undefined;
    }

    canvasPressEvent(event: MouseEvent): void {
        const pickedPrimitive = this.pickPrimitive(event.pos);

        if (!pickedPrimitive) {
            this._selectedPrimitive = undefined;
            return;
        }

        if (
            this.noteDrawing.isTopPoint(pickedPrimitive) ||
            this.noteDrawing.isBottomPointOrDotCirclePolygon(pickedPrimitive)
        ) {
            this._selectedPrimitive = pickedPrimitive;
        } else {
            this._selectedPrimitive = undefined;
            return;
        }

        this._distanceWhenClicked = this.noteDrawing.distance;
        Cartesian2.clone(event.pos, this._mousePositionWhenClicked);

        this.scene.screenSpaceCameraController.enableRotate = false;
    }

    _determineVerticalPlane() {
        const noteDrawing = this.noteDrawing;

        const surfaceNormal = Cartesian3.normalize(noteDrawing.dotCircle.position, surfaceNormalScratch);
        const camera = this.scene.camera;

        const planeNormal = Cartesian3.cross(surfaceNormal, camera.right, planeNormalScratch);

        /**
         * plane equation
         * Ax + By + Cz + D = 0;
         *
         * distance between the given point(x, y, z) and the plane.
         *
         * d = |Ax + By + Cz + D| / squre(A * A + B * B + C * C)
         *
         * distance between the origin(0, 0, 0) and the plane.
         *
         * d = |D| / squre(A * A + B * B + C * C)
         */

        const A = planeNormal.x;
        const B = planeNormal.y;
        const C = planeNormal.z;

        const D = A * planeNormal.x + B * planeNormal.y + C * planeNormal.z;

        const distance = Math.abs(D) / Math.sqrt(A * A + B * B + C * C);

        this._verticalPlane.normal = planeNormal;
        this._verticalPlane.distance = distance;
    }

    // eslint-disable-next-line class-methods-use-this
    canvasMoveEvent(event: MouseEvent) {
        if (event.button !== MouseButton.LeftButton) {
            return;
        }

        if (!this._selectedPrimitive) {
            return;
        }

        const position = this.getWorldPosition(event.pos, cart3Scratch);

        if (!position) {
            return;
        }

        const noteDrawing = this.noteDrawing;

        if (noteDrawing.isTopPoint(this._selectedPrimitive)) {
            this._determineVerticalPlane();

            const verticalScreenPos = Cartesian2.clone(this._mousePositionWhenClicked, verticalScreenPosScratch);

            verticalScreenPos.y = event.pos.y;

            const ray = this.scene.camera.getPickRay(verticalScreenPos, rayScratch);

            if (!ray) {
                return;
            }

            const intersect = IntersectionTests.rayPlane(ray, this._verticalPlane, intersectScratch);

            if (!intersect) {
                return;
            }

            const intersectionCarto = Cartographic.fromCartesian(intersect);
            const dotCircleCarto = Cartographic.fromCartesian(noteDrawing.dotCircle.position);

            const pos = Cartesian3.fromRadians(
                dotCircleCarto.longitude,
                dotCircleCarto.latitude,
                intersectionCarto.height
            );

            noteDrawing.updateLabelPosition(pos);
        } else {
            // bottom point
            const slopeAndAspect = getSlopeAndAspect(this.scene, event.pos);

            if (!slopeAndAspect) {
                return;
            }

            const offsetedPosition = getOffsetedPosition(position, this._distanceWhenClicked, offsetedPositionScratch);

            noteDrawing.updateLabelPosition(offsetedPosition);
            noteDrawing.updateDotCircle(position, slopeAndAspect);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    canvasReleaseEvent(event: MouseEvent): void {
        const scene = this._viewer.scene;
        scene.screenSpaceCameraController.enableRotate = true;
    }
}
