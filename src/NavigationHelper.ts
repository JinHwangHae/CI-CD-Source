/* qeslint-disable */
// q@ts-nocheck

import { Cartesian2, Cartesian3, ScreenSpaceEventHandler, ScreenSpaceEventType, Viewer } from "cesium";

import { DragRotateMarker } from "./DragRotateMarker";
import pickGlobe from "./core/pickGlobe";

const scratchDownMouseTerrainPosition = new Cartesian3();

export default class NavigationHelper {
    private _viewer: Viewer;
    private _screenSpaceEventHandler: ScreenSpaceEventHandler;
    private _rotateStartPositionMarker: DragRotateMarker;

    private _downWorldPosition: Cartesian3 | undefined;

    constructor(options: { viewer: Viewer }) {
        const viewer = options.viewer;

        this._viewer = viewer;
        this._downWorldPosition = undefined;
        this._rotateStartPositionMarker = new DragRotateMarker(options);

        this._screenSpaceEventHandler = new ScreenSpaceEventHandler(this._viewer.canvas);

        this._screenSpaceEventHandler.setInputAction((movement: { position: Cartesian2 }) => {
            this._downWorldPosition = pickGlobe(
                viewer.scene.screenSpaceCameraController,
                movement.position,
                scratchDownMouseTerrainPosition
            );

            if (this._downWorldPosition) {
                this._rotateStartPositionMarker.show = true;
                this._rotateStartPositionMarker.setPosition(this._downWorldPosition);

                const controller = viewer.scene.screenSpaceCameraController;

                // @ts-ignore
                Cartesian2.clone(movement.position, controller._tiltCenterMousePosition);
                // @ts-ignore
                Cartesian3.clone(this._downWorldPosition, controller._tiltCenter);
            }
        }, ScreenSpaceEventType.RIGHT_DOWN);

        this._screenSpaceEventHandler.setInputAction((movement: { position: Cartesian2 }) => {
            const position = pickGlobe(
                viewer.scene.screenSpaceCameraController,
                movement.position,
                scratchDownMouseTerrainPosition
            );

            if (position) {
                const controller = viewer.scene.screenSpaceCameraController;

                // @ts-ignore
                Cartesian2.clone(movement.position, controller._rotateMousePosition);
                // @ts-ignore
                Cartesian3.clone(position, controller._rotateStartPosition);
            }
        }, ScreenSpaceEventType.LEFT_DOWN);

        this._screenSpaceEventHandler.setInputAction((movement: { position: Cartesian2 }) => {
            const position = pickGlobe(
                viewer.scene.screenSpaceCameraController,
                movement.position,
                scratchDownMouseTerrainPosition
            );

            if (position) {
                const controller = viewer.scene.screenSpaceCameraController;

                // @ts-ignore
                Cartesian2.clone(movement.position, controller._zoomMousePosition);
                // @ts-ignore
                Cartesian3.clone(position, controller._zoomPosition);
            }
        }, ScreenSpaceEventType.MIDDLE_DOWN);

        this._screenSpaceEventHandler.setInputAction(() => {
            this._downWorldPosition = undefined;
        }, ScreenSpaceEventType.MOUSE_MOVE);

        this._screenSpaceEventHandler.setInputAction(() => {
            this._downWorldPosition = undefined;
            this._rotateStartPositionMarker.show = false;
        }, ScreenSpaceEventType.RIGHT_UP);

        viewer.scene.preRender.addEventListener(this._onBeforeRender, this);
    }

    _onBeforeRender() {
        if (this._downWorldPosition) {
            // left down
            return;
        }

        if (!this._rotateStartPositionMarker.show) {
            // mouse up
            return;
        }

        // mouse move

        // @ts-ignore
        const tiltCenter = this._viewer.scene.screenSpaceCameraController._tiltCenter;
        this._rotateStartPositionMarker.setPosition(tiltCenter);
    }
}
