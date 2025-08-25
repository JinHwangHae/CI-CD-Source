import {
    Cartesian3,
    ClippingPlane,
    ClippingPlaneCollection,
    destroyObject,
    Matrix3,
    Matrix4,
    Transforms
} from "cesium";
import { TilesetAsset } from "../../../../core";

const scratchReferenceFrame = new Matrix4();
const scratchInvReferenceFrame = new Matrix4();
const scratchRotationMatrix3 = new Matrix3();
const scratch1RotationMatrix3 = new Matrix3();
const scratchMatrix4 = new Matrix4();

const scratchP1 = new Cartesian3();

const scratchInv2 = new Matrix4();

const scratchMatrixAtOffset = new Matrix4();

const scratchNewLeft = new Cartesian3();
const scratchNewRight = new Cartesian3();
const scratchNewFront = new Cartesian3();
const scratchNewBack = new Cartesian3();

// convert the point defined matrix1 coordinate into matrix2 coordinate
function convert(position: Cartesian3, matrix1: Matrix4, matrix2: Matrix4, result: Cartesian3) {
    const p1 = Matrix4.multiplyByPoint(matrix1, position, scratchP1);

    const inv2 = Matrix4.inverseTransformation(matrix2, scratchInv2);

    Matrix4.multiplyByPoint(inv2, p1, result);

    return result;
}

interface TilesetAssetClippingBoxConstructorOptions {
    activate: boolean;
    asset: TilesetAsset;
    center: Cartesian3;
    xDimension: number;
    yDimension: number;
    zDimension: number;
}

export type TilesetAssetClippingBoxStatus = {
    enabled: boolean;
    activated: boolean;
    postId: string;
    distances: [number, number, number, number, number, number];
    clippingPlanesModelMatrix: number[];
    /**
     * matrix4 which contains only translation and rotation around z axis at reference frame of the asset
     */
    prevClippingPlanesModelMatrix: number[];
};

export default class TilesetAssetClippingBox {
    private readonly _asset: TilesetAsset;
    private _rotationCenter: Cartesian3;
    private _actualClippingPlanesModelMatrix: Matrix4;

    /**
     * matrix4 which contains only translation and rotation around z axis at reference frame of the asset.
     * this does not contain inverse rotation of the asset.
     * this is updated whenever clipping planes is rotated.
     */

    private _clippingPlanesModelMatrix: Matrix4;
    /**
     * _clippingPlaneModelMatrix of this just before any translation rotation are done
     */
    private _prevClippingPlanesModelMatrix: Matrix4;

    /**
     * distances of clipping planes just before any translation rotation are done
     */
    private _prevClippingPlanesDistances: [number, number, number, number, number, number];
    private _activated: boolean;
    private _enabled: boolean;

    constructor(options: TilesetAssetClippingBoxConstructorOptions) {
        this._asset = options.asset;

        this._rotationCenter = options.center;
        const tileset = this._asset.tileset;

        const xDimension = options.xDimension;
        const yDimension = options.yDimension;
        const zDimension = options.zDimension;

        const xHalfDimension = xDimension / 2;
        const yHalfDimension = yDimension / 2;
        const zHalfDimension = zDimension / 2;

        let offsetX = 0;
        let offsetY = 0;
        let offsetZ = 0;

        const tilesetOrigin = this._asset.originqq;
        const tilesetEastNorthUpFrame = Transforms.eastNorthUpToFixedFrame(tilesetOrigin);
        const inverse = Matrix4.inverse(tilesetEastNorthUpFrame, new Matrix4());
        const delta = Matrix4.multiplyByPoint(inverse, options.center, new Cartesian3());

        offsetX = delta.x;
        offsetY = delta.y;
        offsetZ = delta.z;

        if (options.activate) {
            if (tileset.clippingPlanes) {
                tileset.clippingPlanes.removeAll();
                tileset.clippingPlanes.enabled = true;
            } else {
                tileset.clippingPlanes = new ClippingPlaneCollection({
                    planes: [],
                    edgeWidth: 1.0,
                    unionClippingRegions: true
                });
            }

            const clippingPlanes = tileset.clippingPlanes;

            clippingPlanes.add(new ClippingPlane(new Cartesian3(1.0, 0.0, 0.0), xHalfDimension - offsetX)); // left
            clippingPlanes.add(new ClippingPlane(new Cartesian3(-1.0, 0.0, 0.0), xHalfDimension + offsetX)); // right
            clippingPlanes.add(new ClippingPlane(new Cartesian3(0.0, 1.0, 0.0), yHalfDimension - offsetY)); // front
            clippingPlanes.add(new ClippingPlane(new Cartesian3(0.0, -1.0, 0.0), yHalfDimension + offsetY)); // back
            clippingPlanes.add(new ClippingPlane(new Cartesian3(0.0, 0.0, -1.0), zHalfDimension + offsetZ)); // up
            clippingPlanes.add(new ClippingPlane(new Cartesian3(0.0, 0.0, 1.0), zHalfDimension - offsetZ)); // down

            this._initModelMatrixOfClippingPlanes();
        }

        const referenceFrame = this._asset.getRefereceFrame(scratchReferenceFrame);

        // @ts-ignore
        // to remove the affect of modelMatrix of the tileset to clippingPlanes 's modelMatrix

        const inv = Matrix4.inverse(tileset.clippingPlanesOriginMatrix, new Matrix4());

        this._actualClippingPlanesModelMatrix = Matrix4.multiply(inv, referenceFrame, new Matrix4());

        this._clippingPlanesModelMatrix = new Matrix4();
        Matrix4.clone(Matrix4.IDENTITY, this._clippingPlanesModelMatrix);

        this._prevClippingPlanesModelMatrix = new Matrix4();
        Matrix4.clone(Matrix4.IDENTITY, this._prevClippingPlanesModelMatrix);

        this._prevClippingPlanesDistances = [
            xHalfDimension - offsetX,
            xHalfDimension + offsetX,
            yHalfDimension - offsetY,
            yHalfDimension + offsetY,
            zHalfDimension + offsetZ,
            zHalfDimension - offsetZ
        ];

        this._activated = options.activate;
        this._enabled = true;
    }

    get activated() {
        return this._activated;
    }

    enable() {
        if (this.activated) {
            this._doActivate();
        }

        this._enabled = true;
    }

    disable() {
        if (this.activated) {
            const tileset = this._asset.tileset;

            tileset.clippingPlanes.removeAll();
        }

        this._enabled = false;
    }

    activate() {
        if (this._enabled) {
            this._doActivate();
        }

        this._activated = true;
    }

    deactivate() {
        const tileset = this._asset.tileset;

        if (tileset.clippingPlanes) {
            tileset.clippingPlanes.enabled = false;

            /**
             * https://github.com/Construkted-Reality/construkted_reality_v1.x/issues/1080
             *
             * why not remove all?
             * even if clipping box is not activated, user can rotate this.
             * distances of clipping planes is necessary to store at them.
             */

            // tileset.clippingPlanes.removeAll();
        }

        this._activated = false;
    }

    setRotationCenter(center: Cartesian3) {
        this._rotationCenter = center;
    }

    move(clippingPlaneIndex: number, moveAmount: number) {
        const clippingPlanes = this._asset.tileset.clippingPlanes;

        const curDistance = clippingPlanes.get(clippingPlaneIndex).distance;

        clippingPlanes.get(clippingPlaneIndex).distance = curDistance + moveAmount;
    }

    rotate(angle: number) {
        const asset = this._asset;
        const tileset = asset.tileset;

        const referenceFrame = this._asset.getRefereceFrame(scratchReferenceFrame);

        // the origin of the clipping planes
        const invReferenceFrame = Matrix4.inverseTransformation(referenceFrame, scratchInvReferenceFrame);

        const translation = Matrix4.multiplyByPoint(invReferenceFrame, this._rotationCenter, new Cartesian3());

        translation.z = 0;

        const rotation = Matrix3.fromRotationZ(angle, scratchRotationMatrix3);

        const clippingPlanes = tileset.clippingPlanes;

        this._initModelMatrixOfClippingPlanes();

        const rotationTranslation = Matrix4.fromRotationTranslation(rotation, translation, scratchMatrix4);

        Matrix4.fromRotationTranslation(rotation, translation, this._clippingPlanesModelMatrix);

        Matrix4.multiply(clippingPlanes.modelMatrix, rotationTranslation, clippingPlanes.modelMatrix);

        // step3 update clipping planes 's distances

        const storedRotation = Matrix3.fromRotationZ(this.heading, scratchRotationMatrix3);

        Matrix4.fromRotationTranslation(storedRotation, translation, scratchMatrixAtOffset);

        const left = new Cartesian3(-this._prevClippingPlanesDistances[0], 0, 0);
        const right = new Cartesian3(this._prevClippingPlanesDistances[1], 0, 0);
        const front = new Cartesian3(0, -this._prevClippingPlanesDistances[2], 0);
        const back = new Cartesian3(0, this._prevClippingPlanesDistances[3], 0);

        const newLeft = convert(left, this._prevClippingPlanesModelMatrix, scratchMatrixAtOffset, scratchNewLeft);
        const newRight = convert(right, this._prevClippingPlanesModelMatrix, scratchMatrixAtOffset, scratchNewRight);
        const newFront = convert(front, this._prevClippingPlanesModelMatrix, scratchMatrixAtOffset, scratchNewFront);
        const newBack = convert(back, this._prevClippingPlanesModelMatrix, scratchMatrixAtOffset, scratchNewBack);

        clippingPlanes.get(0).distance = -newLeft.x;
        clippingPlanes.get(1).distance = newRight.x;
        clippingPlanes.get(2).distance = -newFront.y;
        clippingPlanes.get(3).distance = newBack.y;
    }

    _initModelMatrixOfClippingPlanes() {
        const asset = this._asset;
        const tileset = asset.tileset;
        const referenceFrame = this._asset.getRefereceFrame(scratchReferenceFrame);

        // @ts-ignore
        // to remove the affect of modelMatrix of the tileset to clippingPlanes 's modelMatrix

        const inv = Matrix4.inverse(tileset.clippingPlanesOriginMatrix, new Matrix4());

        tileset.clippingPlanes.modelMatrix = Matrix4.multiply(inv, referenceFrame, new Matrix4());
    }

    storeClippingPlanesParameters() {
        this._clippingPlanesModelMatrix.clone(this._prevClippingPlanesModelMatrix);

        const clippingPlanes = this._asset.tileset.clippingPlanes;

        Matrix4.clone(clippingPlanes.modelMatrix, this._actualClippingPlanesModelMatrix);

        this._prevClippingPlanesDistances = [
            clippingPlanes.get(0).distance,
            clippingPlanes.get(1).distance,
            clippingPlanes.get(2).distance,
            clippingPlanes.get(3).distance,
            clippingPlanes.get(4).distance,
            clippingPlanes.get(5).distance
        ];
    }

    get asset() {
        return this._asset;
    }

    get heading() {
        const rotation = Matrix4.getMatrix3(this._prevClippingPlanesModelMatrix, scratch1RotationMatrix3);

        // https://stackoverflow.com/questions/15022630/how-to-calculate-the-angle-from-rotation-matrix
        return Math.atan2(rotation[1], rotation[0]);
    }

    getStatus() {
        return {
            enabled: this._enabled,
            activated: this._activated,
            postId: this._asset.postId,
            clippingPlanesModelMatrix: Matrix4.toArray(this._actualClippingPlanesModelMatrix),
            distances: this._prevClippingPlanesDistances,
            prevClippingPlanesModelMatrix: Matrix4.toArray(this._prevClippingPlanesModelMatrix)
        } as TilesetAssetClippingBoxStatus;
    }

    loadStatus(status: TilesetAssetClippingBoxStatus) {
        for (let i = 0; i < status.distances.length; i++) {
            this._prevClippingPlanesDistances[i] = status.distances[i];
        }

        Matrix4.unpack(status.clippingPlanesModelMatrix, 0, this._actualClippingPlanesModelMatrix);
        Matrix4.unpack(status.prevClippingPlanesModelMatrix, 0, this._clippingPlanesModelMatrix);
        Matrix4.unpack(status.prevClippingPlanesModelMatrix, 0, this._prevClippingPlanesModelMatrix);

        this._enabled = status.enabled;
        this._activated = status.activated;

        if (status.enabled && status.activated) {
            this._doActivate();
        }
    }

    _doActivate() {
        const tileset = this._asset.tileset;

        if (tileset.clippingPlanes) {
            tileset.clippingPlanes.removeAll();
        } else {
            tileset.clippingPlanes = new ClippingPlaneCollection({
                planes: [],
                edgeWidth: 1.0,
                unionClippingRegions: true
            });
        }

        tileset.clippingPlanes.enabled = true;

        const clippingPlanes = this._asset.tileset.clippingPlanes;

        Matrix4.clone(this._actualClippingPlanesModelMatrix, clippingPlanes.modelMatrix);

        const distances = this._prevClippingPlanesDistances;

        clippingPlanes.add(new ClippingPlane(new Cartesian3(1.0, 0.0, 0.0), distances[0])); // left
        clippingPlanes.add(new ClippingPlane(new Cartesian3(-1.0, 0.0, 0.0), distances[1])); // right
        clippingPlanes.add(new ClippingPlane(new Cartesian3(0.0, 1.0, 0.0), distances[2])); // front
        clippingPlanes.add(new ClippingPlane(new Cartesian3(0.0, -1.0, 0.0), distances[3])); // back
        clippingPlanes.add(new ClippingPlane(new Cartesian3(0.0, 0.0, -1.0), distances[4])); // up
        clippingPlanes.add(new ClippingPlane(new Cartesian3(0.0, 0.0, 1.0), distances[5])); // down
    }

    destroy() {
        if (this._enabled && this._activated) {
            const tileset = this._asset.tileset;

            if (tileset.clippingPlanes) {
                tileset.clippingPlanes.removeAll();
            }
        }

        destroyObject(this);
    }
}
