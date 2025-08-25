/* qeslint-disable */
// q@ts-nocheck

import {
    BoundingSphere,
    Cartesian2,
    Cartesian3,
    DebugModelMatrixPrimitive,
    Event,
    HeadingPitchRoll,
    Matrix3,
    Matrix4,
    Transforms,
    Viewer
} from "cesium";
import { MapTool, MouseEvent } from "../core";
import { ImagePlane } from "./annotation";
import TransformEditor from "../core/TransformEditor/TransformEditor";
import { ImagePlaneScaleController, ImagePlaneScaleControllerType } from "./ImagePlaneScaleController";

const noScale = new Cartesian3(1.0, 1.0, 1.0);

const scratchBoundingSphere = new BoundingSphere();
const scratchBoundingSphere1 = new BoundingSphere();
const scratchArrowPosition2d = new Cartesian2();
const scratchOppositeArrowPosition2d = new Cartesian2();
const scratchAxisVector2d = new Cartesian2();
const scratchMouseMoveVector = new Cartesian2();
const scratchObjectMoveVector2d = new Cartesian2();
const scratchNewArrowPosition2d = new Cartesian2();
const scratchAxisVector3d = new Cartesian3();
const cartesianScratch1 = new Cartesian3();

const debug = false;

const cartesian3Scratch = new Cartesian3();
const hprScratch = new HeadingPitchRoll();
const hprScratch1 = new HeadingPitchRoll();
const matrix3Scratch = new Matrix3();
const matrix4Scratch = new Matrix4();
const matrix4Scratch1 = new Matrix4();
const matrix4Scratch2 = new Matrix4();
const matrix4Scratch3 = new Matrix4();
const matrix4Scratch4 = new Matrix4();

export class ImagePlaneEditTool extends MapTool {
    private readonly _transform: Matrix4 = new Matrix4();
    private _positionBeforeEdit = new Cartesian3();
    private _dimensionsBeforeEdit = new Cartesian2();
    private _headingPitchRollBeforeEdit = new HeadingPitchRoll();
    private _imagePlane: ImagePlane | undefined;
    private _transformEditor: TransformEditor | undefined;
    private _transformEditorPositionChangedRemove: Event.RemoveCallback | undefined;
    private _transformEditorHprChangedRemove: Event.RemoveCallback | undefined;
    private _positionChanged = new Event();
    private _scaleChanged = new Event();
    private _hprChanged = new Event();
    private _imagePlanePositionChangedRemove: Event.RemoveCallback | undefined;
    private _imagePlaneHprChangedRemove: Event.RemoveCallback | undefined;
    private _ignoreImagePlaneEvent = false;
    private _ignoreTransformEditorEvent = false;
    private _positionDebugModelMatrixPrimitive: DebugModelMatrixPrimitive | undefined;
    private readonly _scaleControllers: ImagePlaneScaleController[] = [];
    private _pickedScaleController: ImagePlaneScaleController | undefined;

    constructor(options: { viewer: Viewer }) {
        super({
            name: "ImagePlaneEditTool",
            viewer: options.viewer
        });

        if (debug) {
            this._positionDebugModelMatrixPrimitive = this._viewer.scene.primitives.add(
                new DebugModelMatrixPrimitive({
                    modelMatrix: Matrix4.IDENTITY,
                    length: 1000,
                    width: 5
                })
            );
        }
    }

    get positionChanged() {
        return this._positionChanged;
    }

    get hprChanged() {
        return this._hprChanged;
    }

    get scaleChanged() {
        return this._scaleChanged;
    }

    activate(activateOptions: { imagePlane: ImagePlane }): void {
        super.activate(activateOptions);

        this._imagePlane = activateOptions.imagePlane;
        const planePrimitive = this._imagePlane.planePrimitive;

        Cartesian3.clone(planePrimitive.position, this._positionBeforeEdit);
        HeadingPitchRoll.clone(planePrimitive.hpr, this._headingPitchRollBeforeEdit);

        Cartesian2.clone(planePrimitive.dimensions, this._dimensionsBeforeEdit);

        const transform = this._imagePlane.planePrimitive._computeModelMatrix(this._transform);
        Matrix4.setScale(transform, noScale, transform);

        this._transformEditor = new TransformEditor({
            container: this._viewer.container,
            scene: this._viewer.scene,
            transform: this._transform,
            boundingSphere: planePrimitive.getBoundingSphere(scratchBoundingSphere),
            ignorePitchRollAtTranslator: false
        });

        const viewModel = this._transformEditor.viewModel;

        viewModel.activateTranslationAndRotationMode();

        this._transformEditorPositionChangedRemove = viewModel.positionChanged.addEventListener(
            this._onTranformEditorPositionChanged.bind(this)
        );
        this._transformEditorHprChangedRemove = viewModel.headingPitchRollChanged.addEventListener(
            this._onTransformEditorHprChanged.bind(this)
        );

        this._imagePlanePositionChangedRemove = planePrimitive.positionChanged.addEventListener(
            this._onImagePlanePositionChanged.bind(this)
        );

        this._imagePlaneHprChangedRemove = planePrimitive.hprChanged.addEventListener(
            this._onImagePlaneHprChanged.bind(this)
        );

        if (this._positionDebugModelMatrixPrimitive) {
            this._positionDebugModelMatrixPrimitive.modelMatrix = Transforms.eastNorthUpToFixedFrame(
                this._positionBeforeEdit
            );
        }

        this._createScaleControllers(this._imagePlane);
    }

    _createScaleControllers(imagePlane: ImagePlane) {
        let controller = new ImagePlaneScaleController({
            scene: this._viewer.scene,
            imagePlane: imagePlane,
            type: ImagePlaneScaleControllerType.PositiveX
        });

        this._scaleControllers.push(controller);

        controller = new ImagePlaneScaleController({
            scene: this._viewer.scene,
            imagePlane: imagePlane,
            type: ImagePlaneScaleControllerType.NegativeX
        });

        this._scaleControllers.push(controller);

        controller = new ImagePlaneScaleController({
            scene: this._viewer.scene,
            imagePlane: imagePlane,
            type: ImagePlaneScaleControllerType.PositiveY
        });

        this._scaleControllers.push(controller);

        controller = new ImagePlaneScaleController({
            scene: this._viewer.scene,
            imagePlane: imagePlane,
            type: ImagePlaneScaleControllerType.NegativeY
        });

        this._scaleControllers.push(controller);
    }

    deactivate(deactivateOptions: { normallyDeactivate: boolean }): void {
        super.deactivate(deactivateOptions);

        const revert = !(deactivateOptions && deactivateOptions.normallyDeactivate);

        if (revert && this._imagePlane) {
            this._imagePlane.planePrimitive.position = this._positionBeforeEdit;
            this._imagePlane.planePrimitive.hpr = this._headingPitchRollBeforeEdit;
            this._imagePlane.planePrimitive.dimensions = this._dimensionsBeforeEdit;
            this._imagePlane = undefined;
        }

        if (this._transformEditor) {
            const viewModel = this._transformEditor.viewModel;

            viewModel.deactivate();
            this._transformEditor.destroy();
            this._transformEditor = undefined;

            if (this._transformEditorPositionChangedRemove) {
                this._transformEditorPositionChangedRemove();
                this._transformEditorPositionChangedRemove = undefined;
            }

            if (this._transformEditorHprChangedRemove) {
                this._transformEditorHprChangedRemove();
                this._transformEditorHprChangedRemove = undefined;
            }

            if (this._imagePlanePositionChangedRemove) {
                this._imagePlanePositionChangedRemove();
                this._imagePlanePositionChangedRemove = undefined;
            }

            if (this._imagePlaneHprChangedRemove) {
                this._imagePlaneHprChangedRemove();
                this._imagePlaneHprChangedRemove = undefined;
            }
        }

        this._scaleControllers.forEach((controller) => {
            controller.destroy();
        });

        this._scaleControllers.length = 0;
    }

    _onImagePlanePositionChanged(position: Cartesian3) {
        if (this._ignoreImagePlaneEvent) {
            return;
        }

        if (this._transformEditor) {
            this._transformEditor.viewModel.position = position;
        }
    }

    _onImagePlaneHprChanged(/* hpr: HeadingPitchRoll */) {
        if (this._ignoreImagePlaneEvent) {
            return;
        }

        if (this._transformEditor) {
            const modelMatrix = this._imagePlane!.planePrimitive._computeModelMatrix(new Matrix4());

            const hpr = Transforms.fixedFrameToHeadingPitchRoll(
                modelMatrix,
                this._viewer.scene.mapProjection.ellipsoid,
                undefined,
                hprScratch
            );

            this._ignoreTransformEditorEvent = true;

            this._transformEditor.viewModel.headingPitchRoll = hpr;

            this._ignoreTransformEditorEvent = false;
        }
    }

    _onTranformEditorPositionChanged(position: Cartesian3 /* , oldPosition: Cartesian3 */) {
        if (!this._imagePlane) {
            return;
        }

        this._ignoreImagePlaneEvent = true;
        this._imagePlane.planePrimitive.position = position;
        this._ignoreImagePlaneEvent = false;

        // @ts-ignore
        this._positionChanged.raiseEvent(position);
    }

    _calcImagePlaneHpr() {
        /**
         * from PlanePrimitive _computeModelMatrix
         *
         * M: modelMatrix
         * tWorld: const transform = Transforms.eastNorthUpToFixedFrame(this._position);
         * translation:  const translationMatrix = this.translationMatrix(scratchLocalTransform);
         * R:  const rotationMatrix = this._rotationMatrix(scratchRotationMatrix);
         *
         * M = tWorld * translation * R * scaleMatrix
         *
         * from PlanePrimitive._rotationMatrix
         *
         * R = rotation  * rotationHPR4
         *
         * so M = tWorld * translation * rotation * rotationHPR4 * scaleMatrix
         *
         * rotationHPR4 = inv(tWorld * translation * rotation ) * M * inv(scaleMatrix)
         */

        const planePrimitive = this._imagePlane!.planePrimitive;

        const tWorld = Transforms.eastNorthUpToFixedFrame(planePrimitive.position);
        const translation = planePrimitive.translationMatrix(matrix4Scratch);

        const rotation3 = matrix3Scratch;

        Matrix3.setColumn(rotation3, 0, planePrimitive.left, rotation3);
        Matrix3.setColumn(rotation3, 1, planePrimitive.up, rotation3);
        Matrix3.setColumn(rotation3, 2, planePrimitive.normal, rotation3);

        const rotation = Matrix4.fromRotation(rotation3, matrix4Scratch1);

        const rot = Matrix4.multiply(tWorld, translation, matrix4Scratch2);

        Matrix4.multiply(rot, rotation, rot);
        Matrix4.inverse(rot, rot);

        cartesian3Scratch.x = planePrimitive.dimensions.x;
        cartesian3Scratch.y = planePrimitive.dimensions.y;
        cartesian3Scratch.z = 1;

        const modelMatrix = Matrix4.setScale(this._transform, cartesian3Scratch, matrix4Scratch3);

        Matrix4.multiply(rot, modelMatrix, rot);

        const invScaleMatrix = planePrimitive.scaleMatrix(matrix4Scratch4);
        Matrix4.inverse(invScaleMatrix, invScaleMatrix);

        Matrix4.multiply(rot, invScaleMatrix, rot);

        // https://stackoverflow.com/questions/11514063/extract-yaw-pitch-and-roll-from-a-rotationmatrix
        // yaw=atan2(R(2,1),R(1,1));
        // pitch=atan2(-R(3,1),sqrt(R(3,2)^2+R(3,3)^2)));
        // roll=atan2(R(3,2),R(3,3));

        hprScratch1.heading = -Math.atan2(rot[1], rot[0]);
        hprScratch1.pitch = -Math.atan2(-rot[2], Math.sqrt(rot[6] * rot[6] + rot[10] * rot[10]));
        hprScratch1.roll = Math.atan2(rot[6], rot[10]);

        return hprScratch1;
    }

    _onTransformEditorHprChanged(/* hpr: HeadingPitchRoll , oldHpr: HeadingPitchRoll */) {
        if (this._ignoreTransformEditorEvent) {
            return;
        }

        if (this._imagePlane) {
            this._ignoreImagePlaneEvent = true;

            const hpr = this._calcImagePlaneHpr();

            this._imagePlane.planePrimitive.hpr = hpr;

            this._ignoreImagePlaneEvent = false;
            // @ts-ignore
            this._hprChanged.raiseEvent(hpr);
        }
    }

    _pickScaleController(position: Cartesian2) {
        if (!this._imagePlane) {
            return undefined;
        }

        const pickedObject = this._viewer.scene.pick(position);

        if (pickedObject && pickedObject.primitive) {
            for (let i = 0; i < this._scaleControllers.length; i++) {
                const controller = this._scaleControllers[i];

                if (Object.is(pickedObject.primitive, controller.primitive)) {
                    return controller;
                }
            }
        }

        return undefined;
    }

    canvasPressEvent(event: MouseEvent): void {
        this._pickedScaleController = this._pickScaleController(event.pos);

        if (!this._pickedScaleController) {
            return;
        }

        this._viewer.scene.screenSpaceCameraController.enableRotate = false;
    }

    canvasMoveEvent(event: MouseEvent): void {
        if (!this._pickedScaleController) {
            return;
        }

        if (!this._imagePlane) {
            return;
        }

        const scene = this._viewer.scene;
        const pairedScaleController = this._getPairedScaleController(this._pickedScaleController.type);

        const oppositePosition3d = pairedScaleController.calcPosition();
        const arrowPosition3d = this._pickedScaleController.calcPosition();

        scene.cartesianToCanvasCoordinates(arrowPosition3d, scratchArrowPosition2d);
        scene.cartesianToCanvasCoordinates(oppositePosition3d, scratchOppositeArrowPosition2d);

        // get pixel size for calculation move distance in meters
        scratchBoundingSphere1.center = arrowPosition3d;
        const pixelSize = scene.camera.getPixelSize(
            scratchBoundingSphere1,
            scene.drawingBufferWidth,
            scene.drawingBufferHeight
        );

        // calculate scalar of mouse move
        Cartesian2.subtract(scratchOppositeArrowPosition2d, scratchArrowPosition2d, scratchAxisVector2d);

        Cartesian2.subtract(event.pos, scratchArrowPosition2d, scratchMouseMoveVector);

        const scalar2d =
            Cartesian2.dot(scratchMouseMoveVector, scratchAxisVector2d) /
            Cartesian2.dot(scratchAxisVector2d, scratchAxisVector2d);

        // calculate distance in meters
        Cartesian2.multiplyByScalar(scratchAxisVector2d, scalar2d, scratchObjectMoveVector2d);
        Cartesian2.add(scratchArrowPosition2d, scratchObjectMoveVector2d, scratchNewArrowPosition2d);

        const distance = Cartesian2.distance(scratchNewArrowPosition2d, scratchArrowPosition2d) * pixelSize;

        // calculate Cartesian3 position of arrow
        const scalarDirection = (1 / scalar2d) * Math.abs(scalar2d);
        const scalar3d = (distance / Cartesian3.distance(arrowPosition3d, oppositePosition3d)) * scalarDirection;

        Cartesian3.subtract(oppositePosition3d, arrowPosition3d, scratchAxisVector3d);

        const objectMoveVector3d = Cartesian3.multiplyByScalar(scratchAxisVector3d, scalar3d, new Cartesian3());

        const newArrowPosition3d = Cartesian3.add(arrowPosition3d, objectMoveVector3d, new Cartesian3());

        const origDistance = Cartesian3.distance(arrowPosition3d, oppositePosition3d);
        const newDistance = Cartesian3.distance(newArrowPosition3d, oppositePosition3d);

        const direction = newDistance > origDistance ? 1 : -1;

        const moveAmount = distance * direction;

        const type = this._pickedScaleController.type;
        const dimension = this._imagePlane.planePrimitive.dimensions;

        if (type === ImagePlaneScaleControllerType.PositiveX || type === ImagePlaneScaleControllerType.NegativeX) {
            this._imagePlane.planePrimitive.setDimensionX(dimension.x + moveAmount);
        } else {
            this._imagePlane.planePrimitive.setDimensionY(dimension.y + moveAmount);
        }

        // @ts-ignore
        this._scaleChanged.raiseEvent(this._imagePlane.planePrimitive.dimensions);
    }

    _getPairedScaleController(type: ImagePlaneScaleControllerType) {
        let pairedType = ImagePlaneScaleControllerType.PositiveX;

        if (type === ImagePlaneScaleControllerType.PositiveX) {
            pairedType = ImagePlaneScaleControllerType.NegativeX;
        } else if (type === ImagePlaneScaleControllerType.NegativeX) {
            pairedType = ImagePlaneScaleControllerType.PositiveX;
        } else if (type === ImagePlaneScaleControllerType.PositiveY) {
            pairedType = ImagePlaneScaleControllerType.NegativeY;
        } else if (type === ImagePlaneScaleControllerType.NegativeY) {
            pairedType = ImagePlaneScaleControllerType.PositiveY;
        } else {
            throw new Error("unexpected type");
        }

        const filtered = this._scaleControllers.filter((controller) => controller.type === pairedType);

        if (filtered.length !== 1) {
            throw new Error("oop");
        }

        return filtered[0];
    }

    canvasReleaseEvent(/* event: MouseEvent */): void {
        if (this._pickedScaleController) {
            this._pickedScaleController = undefined;
            this._viewer.scene.screenSpaceCameraController.enableRotate = true;
        }
    }

    canvasDoubleClickEvent(event: MouseEvent) {
        if (!this._imagePlane) {
            return;
        }

        const pos = this.getWorldPositionOn3DTiles(event.pos, cartesianScratch1);

        if (!pos) {
            return;
        }

        this._imagePlane.planePrimitive.position = pos;
    }
}
