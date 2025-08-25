/* qeslint-disable */
// q@ts-nocheck

import {
    BoundingSphere,
    Cartesian2,
    Cartesian3,
    Color,
    destroyObject,
    DataSource,
    Event,
    Model,
    PrimitiveCollection,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType,
    Viewer
} from "cesium";

import SliceArrow from "./SliceArrow";

interface Arrow {
    side: string;
    oppositeSide: string;
    uri: string;
    color: Color;
}

interface SlicerArrowsConstructorOptions {
    moveCallback: (side: string, moveAmount: number, moveVector: Cartesian3) => void;
    positionUpdateCallback: (side: string) => Cartesian3;
    arrowsList: Arrow[];
}

interface Arrows {
    left: SliceArrow;
    right: SliceArrow;
    back: SliceArrow;
    front: SliceArrow;
    top: SliceArrow;
    down: SliceArrow;
}

export default class SlicerArrows {
    private _highlightedArrow: SliceArrow | undefined;
    private readonly _viewer: Viewer;
    private readonly _moveCallback: (side: string, moveAmount: number, moveVector: Cartesian3) => void;
    private readonly _positionUpdateCallback: (side: string) => Cartesian3;

    private readonly _arrowsList: Arrow[];
    private _selectedArrow: SliceArrow | undefined;
    private _eventHandler: ScreenSpaceEventHandler;
    private _enableInputs: boolean;
    private readonly _scratchBoundingSphere: BoundingSphere;
    private readonly _scratchArrowPosition2d: Cartesian2;
    private readonly _scratchOppositeArrowPosition2d: Cartesian2;
    private readonly _scratchAxisVector2d: Cartesian2;
    private readonly _scratchMouseMoveVector: Cartesian2;
    private readonly _scratchObjectMoveVector2d: Cartesian2;
    private readonly _scratchNewArrowPosition2d: Cartesian2;
    private readonly _scratchAxisVector3d: Cartesian3;
    private _arrows!: Arrows;

    private readonly _selectedArrowReleased: Event;

    constructor(viewer: Viewer, dataSource: DataSource, options: SlicerArrowsConstructorOptions) {
        this._viewer = viewer;
        this._moveCallback = options.moveCallback;
        this._positionUpdateCallback = options.positionUpdateCallback;
        this._arrowsList = options.arrowsList;

        this._enableInputs = true;

        this._scratchBoundingSphere = new BoundingSphere();
        this._scratchArrowPosition2d = new Cartesian2();
        this._scratchOppositeArrowPosition2d = new Cartesian2();
        this._scratchAxisVector2d = new Cartesian2();
        this._scratchMouseMoveVector = new Cartesian2();
        this._scratchObjectMoveVector2d = new Cartesian2();
        this._scratchNewArrowPosition2d = new Cartesian2();
        this._scratchAxisVector3d = new Cartesian3();

        this._createArrows();

        this._eventHandler = new ScreenSpaceEventHandler(this._viewer.canvas);

        this._eventHandler.setInputAction(this.onLeftDown.bind(this), ScreenSpaceEventType.LEFT_DOWN);
        this._eventHandler.setInputAction(this.onMouseMove.bind(this), ScreenSpaceEventType.MOUSE_MOVE);
        this._eventHandler.setInputAction(this.onLeftUp.bind(this), ScreenSpaceEventType.LEFT_UP);

        this._selectedArrowReleased = new Event();
    }

    get selectedArrowReleased() {
        return this._selectedArrowReleased;
    }

    showHide(show: boolean) {
        // eslint-disable-next-line no-restricted-syntax, guard-for-in
        for (const side in this._arrows) {
            this._arrows[side as keyof Arrows].show = show;
        }
    }

    onLeftDown(event: { position: Cartesian2 }) {
        const pickedSliceArrow = this._pickSliceArrow(event.position);

        if (pickedSliceArrow) {
            this._selectedArrow = pickedSliceArrow;
            this._enableInputs = this._viewer.scene.screenSpaceCameraController.enableInputs;
            this._viewer.scene.screenSpaceCameraController.enableInputs = false;
        }
    }

    onLeftUp() {
        if (this._selectedArrow) {
            this._selectedArrow = undefined;
            this._viewer.scene.screenSpaceCameraController.enableInputs = this._enableInputs;

            this._selectedArrowReleased.raiseEvent();
        }

        this._unhighlightArrow();
    }

    onMouseMove(movement: { endPosition: Cartesian2 }) {
        if (this._selectedArrow) {
            const scene = this._viewer.scene;
            const side = this._selectedArrow.side;
            const oppositeSide = this._selectedArrow.oppositeSide;
            const oppositeArrow = this._arrows[oppositeSide as keyof Arrows];

            const oppositePosition3d = oppositeArrow.position;
            const arrowPosition3d = this._selectedArrow.position;

            scene.cartesianToCanvasCoordinates(arrowPosition3d, this._scratchArrowPosition2d);
            scene.cartesianToCanvasCoordinates(oppositePosition3d, this._scratchOppositeArrowPosition2d);

            // get pixel size for calculation move distance in meters
            this._scratchBoundingSphere.center = arrowPosition3d;
            const pixelSize = scene.camera.getPixelSize(
                this._scratchBoundingSphere,
                scene.drawingBufferWidth,
                scene.drawingBufferHeight
            );

            // calculate scalar of mouse move
            Cartesian2.subtract(
                this._scratchOppositeArrowPosition2d,
                this._scratchArrowPosition2d,
                this._scratchAxisVector2d
            );

            Cartesian2.subtract(movement.endPosition, this._scratchArrowPosition2d, this._scratchMouseMoveVector);

            const scalar2d =
                Cartesian2.dot(this._scratchMouseMoveVector, this._scratchAxisVector2d) /
                Cartesian2.dot(this._scratchAxisVector2d, this._scratchAxisVector2d);

            // calculate distance in meters
            Cartesian2.multiplyByScalar(this._scratchAxisVector2d, scalar2d, this._scratchObjectMoveVector2d);
            Cartesian2.add(
                this._scratchArrowPosition2d,
                this._scratchObjectMoveVector2d,
                this._scratchNewArrowPosition2d
            );

            const distance =
                Cartesian2.distance(this._scratchNewArrowPosition2d, this._scratchArrowPosition2d) * pixelSize;

            // calculate Cartesian3 position of arrow
            const scalarDirection = (1 / scalar2d) * Math.abs(scalar2d);
            const scalar3d = (distance / Cartesian3.distance(arrowPosition3d, oppositePosition3d)) * scalarDirection;

            Cartesian3.subtract(oppositePosition3d, arrowPosition3d, this._scratchAxisVector3d);

            const objectMoveVector3d = Cartesian3.multiplyByScalar(
                this._scratchAxisVector3d,
                scalar3d,
                new Cartesian3()
            );

            const newArrowPosition3d = Cartesian3.add(arrowPosition3d, objectMoveVector3d, new Cartesian3());

            if (this._moveCallback) {
                const origDistance = Cartesian3.distance(arrowPosition3d, oppositePosition3d);
                const newDistance = Cartesian3.distance(newArrowPosition3d, oppositePosition3d);

                let direction = newDistance > origDistance ? 1 : -1;

                let moveAmount = distance * direction;

                if (side === "up") {
                    direction = this._scratchArrowPosition2d.y > this._scratchNewArrowPosition2d.y ? -1 : 1;

                    moveAmount = distance * direction;
                }

                this._moveCallback(side, moveAmount, objectMoveVector3d);
            }

            this._selectedArrow.update();
        } else {
            this._highlightArrow(movement.endPosition);
        }

        this._viewer.scene.requestRender();
    }

    _createArrows() {
        // @ts-ignore
        this._arrows = {};

        const primitiveCollection = new PrimitiveCollection();

        // @ts-ignore
        primitiveCollection.id = "SlicerArrows-PrimitiveCollection";

        this._viewer.scene.primitives.add(primitiveCollection);

        this._arrowsList.forEach((arrow: Arrow) => {
            const side = arrow.side;

            this._arrows[side as keyof Arrows] = new SliceArrow({
                scene: this._viewer.scene,
                side: side,
                color: arrow.color,
                oppositeSide: arrow.oppositeSide,
                uri: arrow.uri,
                positionUpdateCallback: this._positionUpdateCallback,
                primitiveCollection: primitiveCollection
            });

            this._arrows[side as keyof Arrows].show = false;
        });
    }

    _pickSliceArrow(position: Cartesian2) {
        const pickedObject = this._viewer.scene.pick(position);

        const isModelPicked =
            pickedObject && pickedObject.primitive && pickedObject.primitive instanceof Model && pickedObject.id;

        if (!isModelPicked) {
            return undefined;
        }

        const arrow = this._arrows[pickedObject.id as keyof Arrows];

        if (Object.is(arrow.model, pickedObject.primitive)) {
            return arrow;
        }

        return undefined;
    }

    _highlightArrow(position: Cartesian2) {
        const pickedSliceArrow = this._pickSliceArrow(position);

        if (pickedSliceArrow) {
            this._highlightedArrow = pickedSliceArrow;

            pickedSliceArrow.color = Color.YELLOW;
            this._viewer.canvas.style.cursor = "pointer";
        } else {
            this._unhighlightArrow();
        }
    }

    _unhighlightArrow() {
        if (this._highlightedArrow) {
            this._highlightedArrow.color = this._highlightedArrow.originalColor;
            this._highlightedArrow = undefined;
            this._viewer.canvas.style.cursor = "";
        }
    }

    destroy() {
        this._arrowsList.forEach((arrow: Arrow) => {
            const arrow1 = this._arrows[arrow.side as keyof Arrows];

            arrow1.destroy();
        });

        this._eventHandler.destroy();

        destroyObject(this._eventHandler);
        destroyObject(this);
    }
}
