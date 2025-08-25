/* qeslint-disable */
// q@ts-nocheck

import {
    BoundingSphere,
    Cartesian2,
    Cartesian3,
    // @ts-ignore
    Check,
    defaultValue,
    defined,
    destroyObject,
    Event,
    HeadingPitchRoll,
    Math as CesiumMath,
    Matrix3,
    Matrix4,
    Quaternion,
    PrimitiveCollection,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType,
    Transforms,
    Scene,
    SceneTransforms,
    // @ts-ignore
    knockout
} from "cesium";

import getWidgetOrigin from "../getWidgetOrigin";
import { RotationEditorEx as RotationEditor } from "./RotationEditorEx";
import ScaleEditor from "./ScaleEditor";
import TranslationEditor from "./TranslationEditor";

const widgetPosition = new Cartesian3();
const screenPosition = new Cartesian2();

const noScale = new Cartesian3(1.0, 1.0, 1.0);
const transformScratch = new Matrix4();
const vectorScratch = new Cartesian3();
const scaleScratch = new Cartesian3();
const oldPositionScratch = new Cartesian3();
const oldHeadingPitchRollScratch = new HeadingPitchRoll();

export enum EditorMode {
    TRANSLATION = "translation",
    ROTATION = "rotation",
    SCALE = "scale"
}

const setHprQuaternion = new Quaternion();
const setHprQuaternion2 = new Quaternion();
const setHprTranslation = new Cartesian3();
const setHprScale = new Cartesian3();
const setHprCenter = new Cartesian3();
const setHprTransform = new Matrix4();
const setHprRotation = new Matrix3();

function setHeadingPitchRoll(transform: Matrix4, headingPitchRoll: HeadingPitchRoll) {
    // >>includeStart('debug', pragmas.debug);
    Check.defined("transform", transform);
    Check.defined("headingPitchRoll", headingPitchRoll);
    // >>includeEnd('debug');

    const rotationQuaternion = Quaternion.fromHeadingPitchRoll(headingPitchRoll, setHprQuaternion);
    const translation = Matrix4.getTranslation(transform, setHprTranslation);
    const scale = Matrix4.getScale(transform, setHprScale);
    const center = Matrix4.multiplyByPoint(transform, Cartesian3.ZERO, setHprCenter);
    const backTransform = Transforms.eastNorthUpToFixedFrame(center, undefined, setHprTransform);

    const rotationFixed = Matrix4.getMatrix3(backTransform, setHprRotation);
    const quaternionFixed = Quaternion.fromRotationMatrix(rotationFixed, setHprQuaternion2);
    // @ts-ignore
    const rotation = Quaternion.multiply(quaternionFixed, rotationQuaternion, rotationFixed);

    return Matrix4.fromTranslationQuaternionRotationScale(translation, rotation, scale, transform);
}

type ConstructorOptions = {
    originOffset?: Cartesian3;
    scene: Scene;
    transform: Matrix4;
    boundingSphere: BoundingSphere;
    ignorePitchRollAtTranslator?: boolean;
};

class TransformEditorViewModel {
    private _sseh: ScreenSpaceEventHandler;
    private _scene: Scene;
    private _transform: Matrix4;
    private _boundingSphere: BoundingSphere;
    private _active: boolean;
    private _activeEditor: TranslationEditor | RotationEditor | ScaleEditor | undefined;
    private _originOffset: Cartesian3;

    position: Cartesian3;
    headingPitchRoll: HeadingPitchRoll;
    scale: Cartesian3;

    private _removePostUpdateEvent: Event.RemoveCallback;

    positionChanged: Event;
    headingPitchRollChanged: Event;
    scaleChanged: Event;
    private _activeTranslationAndRotationMode: boolean;

    private _translationEditor: TranslationEditor;
    private _rotationEditor: RotationEditor;
    private _scaleEditor: ScaleEditor;

    private left: string;
    private top: string;

    active: boolean;
    menuExpanded: boolean;
    enableNonUniformScaling: boolean;

    editorMode: EditorMode | undefined;

    constructor(options: ConstructorOptions) {
        // >>includeStart('debug', pragmas.debug);
        Check.defined("options.scene", options.scene);
        Check.defined("options.transform", options.transform);
        Check.defined("options.boundingSphere", options.boundingSphere);
        // >>includeEnd('debug');

        const scene = options.scene;
        const transform = options.transform;
        const boundingSphere = options.boundingSphere.clone();

        const originOffset = defaultValue(options.originOffset, Cartesian3.ZERO);

        const position = Matrix4.getTranslation(transform, new Cartesian3());
        const headingPitchRoll = Transforms.fixedFrameToHeadingPitchRoll(
            transform,
            scene.mapProjection.ellipsoid,
            undefined,
            new HeadingPitchRoll()
        );
        const scale = Matrix4.getScale(transform, new Cartesian3());

        /*
    if (Cartesian3.equalsEpsilon(position, Cartesian3.ZERO, CesiumMath.EPSILON10)) {
        position = Cartesian3.fromDegrees(0, 0, 0, scene.mapProjection.ellipsoid, position);
        transform = Matrix4.setTranslation(transform, position, transform);
        setHeadingPitchRoll(transform, headingPitchRoll);
    }
    */

        let nonUniformScaling = true;

        if (
            CesiumMath.equalsEpsilon(scale.x, scale.y, CesiumMath.EPSILON10) &&
            CesiumMath.equalsEpsilon(scale.x, scale.z, CesiumMath.EPSILON10)
        ) {
            nonUniformScaling = false;
            scale.y = scale.x;
            scale.z = scale.x;
        }

        const initialRadius = boundingSphere.radius / Cartesian3.maximumComponent(scale);

        /**
         * Gets and sets the selected interactive mode.
         * @type {EditorMode}
         */
        this.editorMode = undefined;
        const editorMode = knockout.observable();
        knockout.defineProperty(this, "editorMode", {
            get: function () {
                return editorMode();
            },
            set: function (value: EditorMode) {
                editorMode(value);
                if (defined(this._activeEditor)) {
                    this._activeEditor.active = false;
                }
                let activeEditor;
                if (value === EditorMode.ROTATION) {
                    activeEditor = this._rotationEditor;
                } else if (value === EditorMode.TRANSLATION) {
                    activeEditor = this._translationEditor;
                } else if (value === EditorMode.SCALE) {
                    activeEditor = this._scaleEditor;
                }
                activeEditor.update();
                activeEditor.active = true;
                this._activeEditor = activeEditor;
            }
        });

        /**
         * Gets and sets whether non-uniform scaling is enabled
         * @type {Boolean}
         */
        this.enableNonUniformScaling = nonUniformScaling;
        const enableNonUniformScaling = knockout.observable(this.enableNonUniformScaling);
        knockout.defineProperty(this, "enableNonUniformScaling", {
            get: function () {
                return enableNonUniformScaling();
            },
            set: function (value: boolean) {
                if (value === enableNonUniformScaling()) {
                    return;
                }
                enableNonUniformScaling(value);
                if (!value) {
                    this.scale = new Cartesian3(scale.x, scale.x, scale.x);
                    if (scene.requestRenderMode) {
                        scene.requestRender();
                    }
                }
            }
        });

        /**
         * Gets and sets the position
         * @type {Cartesian3}
         */
        this.position = position;
        const positionObservable = knockout.observable(this.position);
        knockout.defineProperty(this, "position", {
            get: function () {
                return positionObservable();
            },
            set: function (value: Cartesian3) {
                if (Cartesian3.equals(value, this.position)) {
                    return;
                }

                const oldPosition = Matrix4.getTranslation(this._transform, oldPositionScratch);

                // eslint-disable-next-line @typescript-eslint/no-shadow
                const position = Cartesian3.clone(value, this.position);
                positionObservable(position);
                // eslint-disable-next-line @typescript-eslint/no-shadow
                let transform = this._transform;
                transform = Matrix4.setTranslation(transform, position, transform);
                setHeadingPitchRoll(transform, this.headingPitchRoll);
                if (scene.requestRenderMode) {
                    scene.requestRender();
                }

                this.positionChanged.raiseEvent(value, oldPosition);
            }
        });

        /**
         * Gets and sets the heading pitch roll
         * @type {HeadingPitchRoll}
         */
        this.headingPitchRoll = headingPitchRoll;
        const headingPitchRollObservable = knockout.observable(this.headingPitchRoll);
        knockout.defineProperty(this, "headingPitchRoll", {
            get: function () {
                return headingPitchRollObservable();
            },
            set: function (value: HeadingPitchRoll) {
                if (HeadingPitchRoll.equals(value, this.headingPitchRoll)) {
                    return;
                }

                const oldHpr = HeadingPitchRoll.clone(this.headingPitchRoll, oldHeadingPitchRollScratch);

                const hpr = HeadingPitchRoll.clone(value, this.headingPitchRoll);
                headingPitchRollObservable(hpr);
                setHeadingPitchRoll(this._transform, hpr);
                if (scene.requestRenderMode) {
                    scene.requestRender();
                }

                this.headingPitchRollChanged.raiseEvent(value, oldHpr);
            }
        });

        /**
         * Gets and sets the scale
         * @type {Cartesian3}
         */
        this.scale = scale;
        const scaleObservable = knockout.observable(this.scale);
        knockout.defineProperty(this, "scale", {
            get: function () {
                return scaleObservable();
            },
            set: function (value: Cartesian3) {
                if (Cartesian3.equals(value, this.scale)) {
                    return;
                }
                // eslint-disable-next-line @typescript-eslint/no-shadow
                const scale = Cartesian3.clone(value, this.scale);
                scaleObservable(scale);
                Matrix4.setScale(this._transform, scale, this._transform);
                this._translationEditor.update(); // applies the scale to the editing primitives
                this._rotationEditor.update();
                if (scene.requestRenderMode) {
                    scene.requestRender();
                }

                this.scaleChanged.raiseEvent(value);
            }
        });

        /**
         * Gets and sets whether the menu is expanded
         * @type {Boolean}
         */
        this.menuExpanded = false;

        /**
         * Gets the x screen coordinate of the widget menu
         * @type {String}
         * @readonly
         */
        this.left = "0";

        /**
         * Gets the y screen coordinate of the widget menu
         * @type {String}
         * @readonly
         */
        this.top = "0";

        /**
         * Gets whether the widget is active.  Use the activate and deactivate functions to set this value.
         * @type {Boolean}
         * @readonly
         */
        this.active = false;

        knockout.track(this, ["menuExpanded", "left", "top", "active"]);

        const primitiveCollection = new PrimitiveCollection();

        // @ts-ignore
        primitiveCollection.id = "TransformEditorViewModel-PrimitiveCollection";

        scene.primitives.add(primitiveCollection);

        const that = this;
        this._rotationEditor = new RotationEditor({
            scene: scene,
            primitiveCollection: primitiveCollection,
            transform: transform,
            radius: initialRadius,
            originOffset: originOffset,
            setPosition: function (value: Cartesian3) {
                that.position = value;
            },
            setHeadingPitchRoll: function (value: HeadingPitchRoll) {
                that.headingPitchRoll = value;
            }
        });

        this._translationEditor = new TranslationEditor({
            ignorePitchRoll: options.ignorePitchRollAtTranslator,
            scene: scene,
            primitiveCollection: primitiveCollection,
            transform: transform,
            radius: initialRadius,
            originOffset: originOffset,
            setPosition: function (value: Cartesian3) {
                that.position = value;
            }
        });

        this._scaleEditor = new ScaleEditor({
            scene: scene,
            primitiveCollection: primitiveCollection,
            transform: transform,
            enableNonUniformScaling: enableNonUniformScaling,
            radius: initialRadius,
            originOffset: originOffset,
            setScale: function (value: Cartesian3) {
                that.scale = value;
            },
            setPosition: function (value: Cartesian3) {
                that.position = value;
            }
        });

        this._sseh = new ScreenSpaceEventHandler(scene.canvas);
        this._scene = scene;
        this._transform = transform;
        this._boundingSphere = boundingSphere;
        this._active = false;
        this._activeEditor = undefined;
        this._originOffset = originOffset;

        this.position = position;
        this.headingPitchRoll = headingPitchRoll;
        this.scale = scale;

        this._removePostUpdateEvent = this._scene.preUpdate.addEventListener(this._update.bind(this));

        this.positionChanged = new Event();
        this.headingPitchRollChanged = new Event();
        this.scaleChanged = new Event();
        this._activeTranslationAndRotationMode = false;
    }

    get originOffset() {
        return this._originOffset;
    }

    set originOffset(value) {
        // >>includeStart('debug', pragmas.debug);
        Check.defined("value", value);
        // >>includeEnd('debug');
        this._originOffset = value;

        this._translationEditor.originOffset = value;
        this._rotationEditor.originOffset = value;
        this._scaleEditor.originOffset = value;
    }

    get activeTranslationAndRotation() {
        return this._activeTranslationAndRotationMode;
    }

    setOriginPosition(position: Cartesian3) {
        // >>includeStart('debug', pragmas.debug);
        Check.defined("position", position);
        // >>includeEnd('debug');
        const transform = Matrix4.setScale(this._transform, noScale, transformScratch);
        const worldToLocalCoordinates = Matrix4.inverseTransformation(transform, transform);
        const point = Matrix4.multiplyByPoint(worldToLocalCoordinates, position, vectorScratch);
        const offset = Cartesian3.divideComponents(point, Matrix4.getScale(this._transform, scaleScratch), point);

        this.originOffset = offset;
    }

    /**
     * Activates the widget by showing the primitives and enabling mouse handlers
     */
    activate() {
        const sseh = this._sseh;
        const scene = this._scene;

        sseh.setInputAction(this._leftDown.bind(this), ScreenSpaceEventType.LEFT_DOWN);
        sseh.setInputAction(this._leftUp.bind(this), ScreenSpaceEventType.LEFT_UP);
        sseh.setInputAction(this._mouseMove.bind(this), ScreenSpaceEventType.MOUSE_MOVE);
        this.active = true;
        if (this._activeEditor) {
            this._activeEditor.active = true;
        } else {
            this.setModeTranslation();
        }
        if (scene.requestRenderMode) {
            scene.requestRender();
        }
    }

    /**
     * Deactivates the widget by disabling mouse handlers and hiding the primitives
     */
    deactivate() {
        const sseh = this._sseh;
        const scene = this._scene;

        sseh.removeInputAction(ScreenSpaceEventType.LEFT_DOWN);
        sseh.removeInputAction(ScreenSpaceEventType.LEFT_UP);
        sseh.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);

        this.active = false;
        if (defined(this._activeEditor)) {
            this._activeEditor!.active = false;
        }
        if (scene.requestRenderMode) {
            scene.requestRender();
        }

        if (this._activeTranslationAndRotationMode) {
            this._translationEditor.active = false;
            this._rotationEditor.active = false;
            this._activeTranslationAndRotationMode = false;
        }
    }

    /**
     * Expands the widget menu
     */
    expandMenu() {
        this.menuExpanded = true;
    }

    /**
     * Activates the translation interactive mode
     */
    setModeTranslation() {
        this.editorMode = EditorMode.TRANSLATION;
        this.menuExpanded = false;
    }

    /**
     * Activates the rotation interactive mode
     */
    setModeRotation() {
        this.editorMode = EditorMode.ROTATION;
        this.menuExpanded = false;
    }

    /**
     * Activates the scale interactive mode
     */
    setModeScale() {
        this.editorMode = EditorMode.SCALE;
        this.menuExpanded = false;
    }

    /**
     * Toggles whether non-uniform scaling is enabled
     */
    toggleNonUniformScaling() {
        this.enableNonUniformScaling = !this.enableNonUniformScaling;
    }

    _leftDown(click: { position: Cartesian2 }) {
        if (this._activeTranslationAndRotationMode) {
            this._rotationEditor.handleLeftDown(click.position);
            this._translationEditor.handleLeftDown(click.position);
        } else {
            this._activeEditor!.handleLeftDown(click.position);
        }

        const scene = this._scene;
        if (scene.requestRenderMode) {
            scene.requestRender();
        }
    }

    _mouseMove(movement: { endPosition: Cartesian2 }) {
        if (this._activeTranslationAndRotationMode) {
            this._rotationEditor.handleMouseMove(movement.endPosition);
            this._translationEditor.handleMouseMove(movement.endPosition);
        } else {
            this._activeEditor!.handleMouseMove(movement.endPosition);
        }

        const scene = this._scene;
        if (scene.requestRenderMode) {
            scene.requestRender();
        }
    }

    _leftUp() {
        this.menuExpanded = false;

        if (this._activeTranslationAndRotationMode) {
            this._rotationEditor.handleLeftUp();
            this._translationEditor.handleLeftUp();
        } else {
            this._activeEditor!.handleLeftUp();
        }

        const scene = this._scene;
        if (scene.requestRenderMode) {
            scene.requestRender();
        }
    }

    _update() {
        if (!this.active && !this._activeTranslationAndRotationMode) {
            return;
        }

        if (this._activeTranslationAndRotationMode) {
            this._translationEditor.update();
            this._rotationEditor.update();
        } else {
            this._activeEditor!.update();
        }

        const scene = this._scene;
        const position = getWidgetOrigin(this._transform, this._originOffset, widgetPosition);
        const newPos = SceneTransforms.wgs84ToWindowCoordinates(scene, position, screenPosition);
        if (defined(newPos)) {
            this.left = `${Math.floor(newPos.x - 13)}px`;
            this.top = `${Math.floor(newPos.y)}px`;
        }
    }

    /**
     * @returns {Boolean} true if the object has been destroyed, false otherwise.
     */
    // eslint-disable-next-line class-methods-use-this
    isDestroyed() {
        return false;
    }

    /**
     * Destroys the view model.
     */
    destroy() {
        this.deactivate();
        this._sseh.destroy();
        this._rotationEditor.destroy();
        this._translationEditor.destroy();
        this._scaleEditor.destroy();
        this._removePostUpdateEvent();
        destroyObject(this);
    }

    activateTranslationAndRotationMode() {
        const sseh = this._sseh;
        const scene = this._scene;

        sseh.setInputAction(this._leftDown.bind(this), ScreenSpaceEventType.LEFT_DOWN);
        sseh.setInputAction(this._leftUp.bind(this), ScreenSpaceEventType.LEFT_UP);
        sseh.setInputAction(this._mouseMove.bind(this), ScreenSpaceEventType.MOUSE_MOVE);

        this._activeTranslationAndRotationMode = true;
        this._translationEditor.active = true;
        this._rotationEditor.active = true;

        this._translationEditor.update();
        this._rotationEditor.update();

        if (scene.requestRenderMode) {
            scene.requestRender();
        }

        // this._rotationEditor.hideXY();
    }

    get transform() {
        return this._transform;
    }
}

export default TransformEditorViewModel;
