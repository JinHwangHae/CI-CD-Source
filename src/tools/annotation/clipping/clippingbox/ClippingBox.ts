import {
    AxisAlignedBoundingBox,
    BoundingSphere,
    Cartesian2,
    Cartesian3,
    Cartographic,
    CallbackProperty,
    Color,
    CornerType,
    createGuid,
    CustomDataSource,
    destroyObject,
    DeveloperError,
    Entity,
    Event,
    Matrix3,
    Matrix4,
    Transforms,
    Viewer
} from "cesium";

import { TilesetAsset, TilesetAssetGroup } from "../../../../core";

import { RotationMarkerEx as RotationMarker } from "./RotationMarkerEx";
import { getCenter, pickCenterOnEllipsoid, projectPointOnSegment } from "./utils";
import TilesetAssetClippingBox, { TilesetAssetClippingBoxStatus } from "./TilesetAssetClippingBox";
import SlicerArrows from "./SlicerArrows";

const scratchViewCenter = new Cartesian3();
const scratchMatrix3 = new Matrix3();
const scratchInvTransform = new Matrix4();
const scratchLocalZRotationMatrix = new Matrix4();
const scratchTopLeft = new Cartesian3();
const scratchTopRight = new Cartesian3();
const scratchBottomLeft = new Cartesian3();
const scratchBottomRight = new Cartesian3();
const scratchMiddleLeft = new Cartesian3();
const scratchMiddleRight = new Cartesian3();

function moveTwoPositions(position1: Cartesian3, position2: Cartesian3, moveVector: Cartesian3) {
    Cartesian3.add(position1, moveVector, position1);
    Cartesian3.add(position2, moveVector, position2);
}

function extendAtVertical(position: Cartesian3, amount: number, result: Cartesian3) {
    const magnitude = Cartesian3.magnitude(position);

    return Cartesian3.multiplyByScalar(position, (magnitude + amount) / magnitude, result);
}

interface ClippingBoxConstructorOptions {
    viewer: Viewer;
}

interface BottomCorners {
    topLeft: Cartesian3;
    topRight: Cartesian3;
    bottomLeft: Cartesian3;
    bottomRight: Cartesian3;
}

export type ClippingBoxParameters = {
    targetAssetId?: string;
    activated: boolean;
    bottomCorners: {
        bottomLeft: Cartesian3;
        bottomRight: Cartesian3;
        topLeft: Cartesian3;
        topRight: Cartesian3;
    };
    center: Cartesian3;
    clippingBoxes: TilesetAssetClippingBoxStatus[];
    height: number;
    showWall: boolean;
};

export class ClippingBox {
    private readonly _viewer: Viewer;
    private _tilesetAssetGroup: TilesetAssetGroup | undefined;
    private _centerOfActivateOptions: Cartesian3;
    private _dimensionOfActivateOptions: Cartesian3;
    private readonly _dataSource: CustomDataSource;
    private readonly _bottomCorners: BottomCorners;
    private readonly _bottomCornersAtLocal: BottomCorners;
    private readonly _rotationMarker: RotationMarker;
    private readonly _slicerArrows: SlicerArrows;
    private _id: string;
    private readonly _removeSelectedArrowReleased: Event.RemoveCallback;
    private readonly _removeRotated: Event.RemoveCallback;
    private readonly _removeRotationFinished: Event.RemoveCallback;

    private _transform: Matrix4;
    private _height: number;
    private _assetClippingBoxes: TilesetAssetClippingBox[];

    private _clippingBoxEntity: Entity | undefined;
    private _lastStatus: ClippingBoxParameters | undefined;
    private _activated: boolean;

    /**
     * https://github.com/Construkted-Reality/construkted_reality_v1.x/issues/1072
     *
     * If this is undefined, then the clipping box is applied to all assets.
     * If this is assigned, clipping box only affect that asset.
     */

    constructor(options: ClippingBoxConstructorOptions) {
        this._id = createGuid();
        this._centerOfActivateOptions = new Cartesian3();
        this._dimensionOfActivateOptions = new Cartesian3();
        this._viewer = options.viewer;
        this._dataSource = new CustomDataSource("ClippingBox");
        this._viewer.dataSources.add(this._dataSource);

        this._transform = new Matrix4();

        this._bottomCornersAtLocal = {
            topLeft: new Cartesian3(),
            topRight: new Cartesian3(),
            bottomLeft: new Cartesian3(),
            bottomRight: new Cartesian3()
        };

        this._bottomCorners = {
            topLeft: new Cartesian3(),
            topRight: new Cartesian3(),
            bottomLeft: new Cartesian3(),
            bottomRight: new Cartesian3()
        };

        const imagesRoot = `${window.Construkted.assetsRootUrl()}/glbs`;

        const SLICE_BOX_ARROWS_INSIDE = [
            {
                side: "left",
                oppositeSide: "right",
                uri: `${imagesRoot}/sphere.glb`,
                color: Color.LIMEGREEN
            },
            {
                side: "right",
                oppositeSide: "left",
                uri: `${imagesRoot}/sphere.glb`,
                color: Color.LIMEGREEN
            },
            {
                side: "back",
                oppositeSide: "front",
                uri: `${imagesRoot}/sphere.glb`,
                color: Color.TOMATO
            },
            {
                side: "front",
                oppositeSide: "back",
                uri: `${imagesRoot}/sphere.glb`,
                color: Color.TOMATO
            }
        ];

        const SLICE_BOX_ARROWS_OUTSIDE = [
            ...SLICE_BOX_ARROWS_INSIDE,
            {
                side: "down",
                oppositeSide: "up",
                uri: `${imagesRoot}/sphere.glb`,
                color: Color.DODGERBLUE
            },
            {
                side: "up",
                oppositeSide: "down",
                uri: `${imagesRoot}/sphere.glb`,
                color: Color.DODGERBLUE
            }
        ];

        this._slicerArrows = new SlicerArrows(this.viewer, this.dataSource, {
            moveCallback: (side: string, moveAmount: number, moveVector: Cartesian3) =>
                this._onSelectedArrowMoved(side, moveAmount, moveVector),
            positionUpdateCallback: (side: string) => this._arrowPositionUpdateCallback(side),
            arrowsList: SLICE_BOX_ARROWS_OUTSIDE
        });

        this._height = 0;
        this._assetClippingBoxes = [];

        this._removeSelectedArrowReleased = this._slicerArrows.selectedArrowReleased.addEventListener(
            this._onSelectedArrowReleased.bind(this)
        );

        this._rotationMarker = new RotationMarker({
            scene: this._viewer.scene
        });

        this._removeRotated = this._rotationMarker.rotated.addEventListener(this._onRotationMarkerRotated.bind(this));
        this._removeRotationFinished = this._rotationMarker.rotationFinished.addEventListener(
            this._onRotationMarkerRotationFinished.bind(this)
        );

        this._activated = false;
    }

    get id() {
        return this._id;
    }

    set id(val) {
        this._id = val;
    }

    get activated() {
        return this._activated;
    }

    get showWall() {
        if (!this._clippingBoxEntity) {
            return false;
        }

        return this._clippingBoxEntity.show;
    }

    set showWall(show: boolean) {
        if (!this._clippingBoxEntity) {
            return;
        }

        this._clippingBoxEntity.show = show;
    }

    get viewer() {
        return this._viewer;
    }

    get dataSource() {
        return this._dataSource;
    }

    storeStatus() {
        this._lastStatus = this.getParameters();
    }

    restoreStatus() {
        console.assert(this._lastStatus, "error");

        this.loadParameters(this._lastStatus!);
    }

    reset() {
        console.assert(this._tilesetAssetGroup !== undefined, "error");

        const tilesetAssetGroup = this._tilesetAssetGroup!;

        this._clear();
        this.doActivate({
            tilesetAssetGroup: tilesetAssetGroup,
            center: this._centerOfActivateOptions,
            dimension: this._dimensionOfActivateOptions
        });
    }

    deactivate() {
        if (!this._activated) {
            return;
        }

        this._assetClippingBoxes.forEach((clippingBox) => {
            clippingBox.deactivate();
        });

        this._activated = false;
    }

    activate() {
        if (this._activated) {
            return;
        }

        this._assetClippingBoxes.forEach((clippingBox) => {
            clippingBox.activate();
        });

        this._activated = true;
    }

    doActivate(options: { tilesetAssetGroup: TilesetAssetGroup; center: Cartesian3; dimension: Cartesian3 }) {
        const tilesetAssetGroup = options.tilesetAssetGroup;
        const center = options.center;

        const xDimension = options.dimension.x;
        const yDimension = options.dimension.y;
        const zDimension = options.dimension.z;

        const xHalfDimension = xDimension / 2;
        const yHalfDimension = yDimension / 2;
        const zHalfDimension = zDimension / 2;

        const bottomCornersInLocal = this._bottomCornersAtLocal;

        Cartesian3.unpack([-xHalfDimension, -yHalfDimension, -zHalfDimension], 0, bottomCornersInLocal.topLeft);
        Cartesian3.unpack([xHalfDimension, -yHalfDimension, -zHalfDimension], 0, bottomCornersInLocal.topRight);
        Cartesian3.unpack([-xHalfDimension, yHalfDimension, -zHalfDimension], 0, bottomCornersInLocal.bottomLeft);
        Cartesian3.unpack([xHalfDimension, yHalfDimension, -zHalfDimension], 0, bottomCornersInLocal.bottomRight);

        Transforms.eastNorthUpToFixedFrame(center, undefined, this._transform);

        this._updateBottomCornersInWorld();

        this._height = zDimension;

        this._createBoxEntity();

        tilesetAssetGroup.assets.forEach((asset) => {
            this._assetClippingBoxes.push(
                new TilesetAssetClippingBox({
                    activate: true,
                    asset: asset,
                    center: center,
                    xDimension: xDimension,
                    yDimension: yDimension,
                    zDimension: zDimension
                })
            );
        });

        this._rotationMarker.update(this.bottomCorners);

        this._tilesetAssetGroup = tilesetAssetGroup;
        Cartesian3.clone(options.center, this._centerOfActivateOptions);
        Cartesian3.clone(options.dimension, this._dimensionOfActivateOptions);

        this._activated = true;
    }

    showHideEditingBalls(show: boolean) {
        this._slicerArrows.showHide(show);
    }

    showEditControls(show: boolean) {
        this._slicerArrows.showHide(show);
        this._rotationMarker.show = show;
    }

    _rotateBottomCorners(angle: number) {
        const bottomCornersInLocal = this._bottomCornersAtLocal;

        const topLeft = bottomCornersInLocal.topLeft.clone(scratchTopLeft);
        const topRight = bottomCornersInLocal.topRight.clone(scratchTopRight);
        const bottomLeft = bottomCornersInLocal.bottomLeft.clone(scratchBottomLeft);
        const bottomRight = bottomCornersInLocal.bottomRight.clone(scratchBottomRight);

        const rotation = Matrix3.fromRotationZ(angle, scratchMatrix3);
        const rotationMatrix = Matrix4.multiplyByMatrix3(Matrix4.IDENTITY, rotation, scratchLocalZRotationMatrix);

        // rotate local corners
        Matrix4.multiplyByPoint(rotationMatrix, topLeft, topLeft);
        Matrix4.multiplyByPoint(rotationMatrix, topRight, topRight);
        Matrix4.multiplyByPoint(rotationMatrix, bottomLeft, bottomLeft);
        Matrix4.multiplyByPoint(rotationMatrix, bottomRight, bottomRight);

        const bottomCorners = this._bottomCorners;

        // update world corners
        Matrix4.multiplyByPoint(this._transform, topLeft, bottomCorners.topLeft);
        Matrix4.multiplyByPoint(this._transform, topRight, bottomCorners.topRight);
        Matrix4.multiplyByPoint(this._transform, bottomLeft, bottomCorners.bottomLeft);
        Matrix4.multiplyByPoint(this._transform, bottomRight, bottomCorners.bottomRight);
    }

    _onRotationMarkerRotated(angle: number) {
        this._rotateBottomCorners(this._rotationMarker.accumulatedRotationAngle + angle);

        this._assetClippingBoxes.forEach((clippingBox) => {
            clippingBox.rotate(clippingBox.heading + angle);
        });
    }

    _onRotationMarkerRotationFinished() {
        this._assetClippingBoxes.forEach((clippingBox) => {
            clippingBox.storeClippingPlanesParameters();
        });
    }

    get bottomCorners() {
        const bottomCorners = this._bottomCorners;

        return [bottomCorners.topLeft, bottomCorners.topRight, bottomCorners.bottomLeft, bottomCorners.topRight];
    }

    _updateBottomCornersInWorld() {
        const bottomCornersInLocal = this._bottomCornersAtLocal;

        Matrix4.multiplyByPoint(this._transform, bottomCornersInLocal.topLeft, this._bottomCorners.topLeft);
        Matrix4.multiplyByPoint(this._transform, bottomCornersInLocal.topRight, this._bottomCorners.topRight);
        Matrix4.multiplyByPoint(this._transform, bottomCornersInLocal.bottomLeft, this._bottomCorners.bottomLeft);
        Matrix4.multiplyByPoint(this._transform, bottomCornersInLocal.bottomRight, this._bottomCorners.bottomRight);
    }

    _createBoxEntity() {
        const boxPositions = [
            this._bottomCorners.bottomRight,
            this._bottomCorners.bottomLeft,
            this._bottomCorners.topLeft,
            this._bottomCorners.topRight,
            this._bottomCorners.bottomRight
        ];

        const shapeWidth = 0.1;

        this._clippingBoxEntity = this._dataSource.entities.add({
            polylineVolume: {
                positions: new CallbackProperty(() => {
                    const ret: Cartesian3[] = [];

                    boxPositions.forEach((position) => {
                        ret.push(position.clone());
                    });

                    return ret;
                }, false),
                cornerType: CornerType.MITERED,
                outline: false,
                material: Color.WHITE.withAlpha(0.2),
                shape: new CallbackProperty(() => {
                    const startZ = 0;
                    const endZ = startZ + this._height;

                    return [
                        new Cartesian2(0, startZ),
                        new Cartesian2(shapeWidth, startZ),
                        new Cartesian2(shapeWidth, endZ),
                        new Cartesian2(0, endZ)
                    ];
                }, false)
            }
        });
    }

    _arrowPositionUpdateCallback(side: string) {
        if (!this._tilesetAssetGroup) {
            return Cartesian3.ZERO;
        }

        const clippingBoxHeight = this._height;
        const corners = this._bottomCorners;

        if (!clippingBoxHeight || Number.isNaN(clippingBoxHeight)) {
            throw new DeveloperError("invalid clippingBoxHeight");
        }

        let viewCenter = pickCenterOnEllipsoid(this.viewer.scene);

        if (!viewCenter) {
            viewCenter = getCenter(
                [corners.bottomLeft, corners.bottomRight, corners.topLeft, corners.topRight],
                scratchViewCenter
            );
        }

        const heightOffset = clippingBoxHeight / 2;

        const start = 0.5;
        const end = 0.5;

        const cartoBottomRight = Cartographic.fromCartesian(corners.bottomRight);
        const baseHeight = cartoBottomRight.height;
        const middleLeft = Cartesian3.midpoint(corners.bottomLeft, corners.topLeft, scratchMiddleLeft);
        const middleRight = Cartesian3.midpoint(corners.bottomRight, corners.topRight, scratchMiddleRight);

        switch (side) {
            case "down": {
                return projectPointOnSegment(
                    viewCenter,
                    middleLeft,
                    middleRight,
                    start,
                    end,
                    baseHeight + clippingBoxHeight
                );
            }
            case "up": {
                return projectPointOnSegment(viewCenter, middleLeft, middleRight, start, end, baseHeight);
            }
            case "right":
                return projectPointOnSegment(
                    viewCenter,
                    corners.bottomRight,
                    corners.topRight,
                    start,
                    end,
                    baseHeight + heightOffset
                );
            case "left": {
                return projectPointOnSegment(
                    viewCenter,
                    corners.bottomLeft,
                    corners.topLeft,
                    start,
                    end,
                    baseHeight + heightOffset
                );
            }
            case "back":
                return projectPointOnSegment(
                    viewCenter,
                    corners.bottomRight,
                    corners.bottomLeft,
                    start,
                    end,
                    baseHeight + heightOffset
                );
            case "front":
                return projectPointOnSegment(
                    viewCenter,
                    corners.topRight,
                    corners.topLeft,
                    start,
                    end,
                    baseHeight + heightOffset
                );
            default:
                throw new DeveloperError("should not be reached");
        }
    }

    drawBoundingSphere() {
        const boundingSphere = this._tilesetAssetGroup!.getBoundingSphere(new BoundingSphere());

        const radii = boundingSphere.radius;

        this._viewer.entities.add({
            position: boundingSphere.center,
            ellipsoid: {
                radii: new Cartesian3(radii, radii, radii),
                outlineColor: Color.YELLOW,
                outline: true,
                fill: false
            }
        });
    }

    getBoundingSphere(result: BoundingSphere) {
        return this._tilesetAssetGroup!.getBoundingSphere(result);
    }

    drawAABoundingBox() {
        const aabbox = this._tilesetAssetGroup!.getAABoundingBox(new AxisAlignedBoundingBox());

        const dimensions = Cartesian3.subtract(aabbox.maximum, aabbox.minimum, new Cartesian3());

        this._viewer.entities.add({
            position: aabbox.center,
            box: {
                dimensions: dimensions,
                fill: true,
                outline: true,
                outlineColor: Color.YELLOW,
                material: Color.BLUE.withAlpha(0.2)
            }
        });
    }

    _moveClippingPlanes(clippingPlaneIndex: number, moveAmount: number) {
        this._assetClippingBoxes.forEach((clippingBox) => {
            clippingBox.move(clippingPlaneIndex, moveAmount);
        });
    }

    _updateBottomCornersInLocal() {
        const invTransform = Matrix4.inverseTransformation(this._transform, scratchInvTransform);

        const bottomCorners = this._bottomCorners;

        Matrix4.multiplyByPoint(invTransform, bottomCorners.topLeft, this._bottomCornersAtLocal.topLeft);
        Matrix4.multiplyByPoint(invTransform, bottomCorners.topRight, this._bottomCornersAtLocal.topRight);
        Matrix4.multiplyByPoint(invTransform, bottomCorners.bottomLeft, this._bottomCornersAtLocal.bottomLeft);
        Matrix4.multiplyByPoint(invTransform, bottomCorners.bottomRight, this._bottomCornersAtLocal.bottomRight);
    }

    _onSelectedArrowReleased() {
        const positions = this.bottomCorners;
        const boundingSphere = BoundingSphere.fromPoints(positions);

        Transforms.eastNorthUpToFixedFrame(boundingSphere.center, undefined, this._transform);

        this._assetClippingBoxes.forEach((clippingBox) => {
            clippingBox.setRotationCenter(boundingSphere.center);
            clippingBox.storeClippingPlanesParameters();
        });

        this._updateBottomCornersInLocal();

        this._rotationMarker.reset();
    }

    _onSelectedArrowMoved(side: string, moveAmount: number, moveVector: Cartesian3) {
        const corners = this._bottomCorners;

        switch (side) {
            case "left": {
                moveTwoPositions(corners.topLeft, corners.bottomLeft, moveVector);
                this._moveClippingPlanes(0, moveAmount);
                break;
            }
            case "right": {
                moveTwoPositions(corners.topRight, corners.bottomRight, moveVector);
                this._moveClippingPlanes(1, moveAmount);
                break;
            }
            case "front": {
                moveTwoPositions(corners.topLeft, corners.topRight, moveVector);
                this._moveClippingPlanes(2, moveAmount);
                break;
            }
            case "back": {
                moveTwoPositions(corners.bottomLeft, corners.bottomRight, moveVector);
                this._moveClippingPlanes(3, moveAmount);
                break;
            }
            case "up": {
                let boxHeight = this._height;

                boxHeight += moveAmount;

                if (boxHeight < 0.1) {
                    console.warn("min reached");
                    return;
                }

                this._height = boxHeight;

                Cartesian3.add(corners.topLeft, moveVector, corners.topLeft);
                Cartesian3.add(corners.bottomLeft, moveVector, corners.bottomLeft);
                Cartesian3.add(corners.topRight, moveVector, corners.topRight);
                Cartesian3.add(corners.bottomRight, moveVector, corners.bottomRight);

                this._moveClippingPlanes(5, moveAmount);

                break;
            }
            case "down": {
                let boxHeight = this._height;

                boxHeight += moveAmount;

                if (boxHeight < 0.1) {
                    console.warn("min reached");
                    return;
                }

                this._height = boxHeight;

                this._moveClippingPlanes(4, moveAmount);
                break;
            }
            default: {
                console.error("should not be reached");
            }
        }

        this._rotationMarker.update(this.bottomCorners);
    }

    get aabbox() {
        const bottomCorners = this.bottomCorners;

        const topCorners: Cartesian3[] = [];

        bottomCorners.forEach((position) => {
            topCorners.push(extendAtVertical(position, this._height, new Cartesian3()));
        });

        const positions = bottomCorners.concat(topCorners);

        return AxisAlignedBoundingBox.fromPoints(positions);
    }

    getParameters() {
        const clippingBoxes: TilesetAssetClippingBoxStatus[] = [];

        this._assetClippingBoxes.forEach((clippingBox) => {
            clippingBoxes.push(clippingBox.getStatus());
        });

        const center = Matrix4.getTranslation(this._transform, new Cartesian3());

        return {
            activated: this._activated,
            center: center,
            bottomCorners: {
                bottomLeft: Cartesian3.clone(this._bottomCorners.bottomLeft, new Cartesian3()),
                bottomRight: Cartesian3.clone(this._bottomCorners.bottomRight, new Cartesian3()),
                topLeft: Cartesian3.clone(this._bottomCorners.topLeft, new Cartesian3()),
                topRight: Cartesian3.clone(this._bottomCorners.topRight, new Cartesian3())
            },
            height: this._height,
            showWall: this._clippingBoxEntity!.show,
            clippingBoxes: clippingBoxes
        } as ClippingBoxParameters;
    }

    _clear() {
        Matrix4.ZERO.clone(this._transform);

        const bottomCornersAtLocal = this._bottomCornersAtLocal;
        const zero = Cartesian3.ZERO;

        Cartesian3.clone(zero, bottomCornersAtLocal.topLeft);
        Cartesian3.clone(zero, bottomCornersAtLocal.topRight);
        Cartesian3.clone(zero, bottomCornersAtLocal.bottomLeft);
        Cartesian3.clone(zero, bottomCornersAtLocal.bottomRight);

        const bottomCorners = this._bottomCorners;

        Cartesian3.clone(zero, bottomCorners.topLeft);
        Cartesian3.clone(zero, bottomCorners.topRight);
        Cartesian3.clone(zero, bottomCorners.bottomLeft);
        Cartesian3.clone(zero, bottomCorners.bottomRight);

        if (this._clippingBoxEntity) {
            this._dataSource.entities.remove(this._clippingBoxEntity);
            this._clippingBoxEntity = undefined;
        }

        this._height = 0;

        this._assetClippingBoxes.forEach((clippingBox) => {
            clippingBox.destroy();
        });

        this._assetClippingBoxes = [];
        this._rotationMarker.clear();

        this._tilesetAssetGroup = undefined;
    }

    loadParameters(data: ClippingBoxParameters) {
        this._activated = data.activated;
        this._clear();

        const dataCenter = data.center;
        const center = new Cartesian3(dataCenter.x, dataCenter.y, dataCenter.z);

        Transforms.eastNorthUpToFixedFrame(center, undefined, this._transform);

        const bottomCorners = data.bottomCorners;

        const topLeft = bottomCorners.topLeft;
        const topRight = bottomCorners.topRight;
        const bottomLeft = bottomCorners.bottomLeft;
        const bottomRight = bottomCorners.bottomRight;

        Cartesian3.unpack([topLeft.x, topLeft.y, topLeft.z], 0, this._bottomCorners.topLeft);
        Cartesian3.unpack([topRight.x, topRight.y, topRight.z], 0, this._bottomCorners.topRight);
        Cartesian3.unpack([bottomLeft.x, bottomLeft.y, bottomLeft.z], 0, this._bottomCorners.bottomLeft);
        Cartesian3.unpack([bottomRight.x, bottomRight.y, bottomRight.z], 0, this._bottomCorners.bottomRight);

        this._updateBottomCornersInLocal();

        this._height = data.height;

        if (this._clippingBoxEntity) {
            this._dataSource.entities.remove(this._clippingBoxEntity);
        }

        this._createBoxEntity();

        const clippingBoxes = data.clippingBoxes;

        const construkted = window.Construkted;
        const aabbox = this.aabbox;

        const maximum = aabbox.maximum;
        const minimum = aabbox.minimum;
        const xDimension = maximum.x - minimum.x;
        const yDimension = maximum.y - minimum.y;
        const zDimension = maximum.z - minimum.z;

        const assets: TilesetAsset[] = [];

        clippingBoxes.forEach((clippingBox: TilesetAssetClippingBoxStatus) => {
            const postId = clippingBox.postId;

            const tilesetAsset = construkted.getTilesetAsset(postId);

            if (!tilesetAsset) {
                return;
            }

            const tilesetClippingBox = new TilesetAssetClippingBox({
                activate: false,
                asset: tilesetAsset,
                center: center,
                xDimension: xDimension,
                yDimension: yDimension,
                zDimension: zDimension
            });

            tilesetClippingBox.loadStatus(clippingBox);

            this._assetClippingBoxes.push(tilesetClippingBox);

            assets.push(tilesetAsset);
        });

        this._rotationMarker.update(this.bottomCorners);

        this._tilesetAssetGroup = new TilesetAssetGroup({
            assets: assets
        });

        Cartesian3.clone(center, this._centerOfActivateOptions);
        this._dimensionOfActivateOptions.x = xDimension;
        this._dimensionOfActivateOptions.y = yDimension;
        this._dimensionOfActivateOptions.z = zDimension;

        this.setTargetAsset(data.targetAssetId);

        this._viewer.scene.requestRender();
    }

    setTargetAsset(postId: string | undefined) {
        if (postId === undefined) {
            for (let i = 0; i < this._assetClippingBoxes.length; i++) {
                this._assetClippingBoxes[i].enable();
            }
        } else {
            for (let i = 0; i < this._assetClippingBoxes.length; i++) {
                if (this._assetClippingBoxes[i].asset.postId === postId) {
                    this._assetClippingBoxes[i].enable();
                } else {
                    this._assetClippingBoxes[i].disable();
                }
            }
        }
    }

    destroy() {
        this._viewer.dataSources.remove(this._dataSource);
        this._slicerArrows.destroy();
        this._assetClippingBoxes.forEach((b) => {
            b.destroy();
        });

        this._removeSelectedArrowReleased();
        this._removeRotated();
        this._removeRotationFinished();
        this._rotationMarker.destroy();
        destroyObject(this);
    }
}
