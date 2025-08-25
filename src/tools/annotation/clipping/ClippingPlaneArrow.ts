import {
    Cartesian3,
    Cartesian4,
    destroyObject,
    Event,
    Math as CesiumMath,
    Matrix3,
    Matrix4,
    Model,
    Scene,
    Transforms,
    Color
} from "cesium";
import { calculateModelScale } from "../../../core/calculateModelScale";

interface ClippingPlaneArrowConstructorOptions {
    scene: Scene;
    position: Cartesian3;
    distance: number;
    normal: Cartesian3;
}

const PIXEL_SIZE = 100;

const scratchAxis = new Cartesian3();
const scratchUp = new Cartesian3();
const scratchTranslation = new Cartesian3();
const scratchScale = new Cartesian3();
const scratchRotation = new Matrix3();
const scratchRotationScale = new Matrix3();
const scratchLocalTransform = new Matrix4();

export class ClippingPlaneArrow {
    private readonly _scene: Scene;
    private _position: Cartesian3;
    private _normal: Cartesian3;
    private _distance: number;
    private _model: Model | undefined;
    private readonly _removeCallback: Event.RemoveCallback;
    private _show: boolean;

    constructor(options: ClippingPlaneArrowConstructorOptions) {
        this._scene = options.scene;

        this._position = Cartesian3.clone(options.position, new Cartesian3());

        const transform = Transforms.eastNorthUpToFixedFrame(this._position);

        const invTransform = Matrix4.inverseTransformation(transform, new Matrix4());

        /**
         * options.normal is given in the world coordinate
         * so we need to convert it into local coordinate.
         */
        const normal = Matrix4.multiplyByVector(
            invTransform,
            new Cartesian4(options.normal.x, options.normal.y, options.normal.z, 0),
            new Cartesian4()
        );

        this._normal = new Cartesian3(normal.x, normal.y, normal.z);

        this._distance = options.distance;

        const url = `${window.Construkted.assetsRootUrl()}/glbs/arrowA.glb`;

        this._show = false;

        const promise = Model.fromGltfAsync({
            show: this._show,
            url: url,
            color: Color.YELLOW
        });

        promise.then((model: Model) => {
            this._model = model;
            this._scene.primitives.add(this._model);
        });

        this._removeCallback = this._scene.preRender.addEventListener(() => {
            this._onPreRender();
        });
    }

    get distance() {
        return this._distance;
    }

    set distance(val) {
        this._distance = val;
    }

    set show(val: boolean) {
        this._show = val;

        if (!this._model) {
            return;
        }

        this._model.show = val;
    }

    _onPreRender() {
        if (!this._model) {
            return;
        }

        if (!this._model.ready) {
            return;
        }

        if (this._show) {
            this._updateModelMatrix();
            this._model.scale = calculateModelScale(this._scene, this._model, PIXEL_SIZE);
        }
    }

    _updateModelMatrix() {
        if (!this._model) {
            return;
        }

        if (this._show !== this._model.show) {
            this._model.show = this._show;
        }

        const normal = this._normal;
        const distance = this._distance;

        const translation = Cartesian3.multiplyByScalar(normal, -distance, scratchTranslation);

        let up = Cartesian3.clone(Cartesian3.UNIT_Z, scratchUp);

        if (CesiumMath.equalsEpsilon(Math.abs(Cartesian3.dot(up, normal)), 1.0, CesiumMath.EPSILON8)) {
            up = Cartesian3.clone(Cartesian3.UNIT_Y, up);
        }

        const left = Cartesian3.cross(up, normal, scratchAxis);
        up = Cartesian3.cross(normal, left, up);
        Cartesian3.normalize(left, left);
        Cartesian3.normalize(up, up);

        const rotationMatrix = scratchRotation;

        Matrix3.setColumn(rotationMatrix, 0, left, rotationMatrix);
        Matrix3.setColumn(rotationMatrix, 1, up, rotationMatrix);
        Matrix3.setColumn(rotationMatrix, 2, normal, rotationMatrix);

        const scale = Cartesian3.fromElements(1.0, 1.0, 1.0, scratchScale);
        const rotationScaleMatrix = Matrix3.multiplyByScale(rotationMatrix, scale, scratchRotationScale);

        const localTransform = Matrix4.fromRotationTranslation(rotationScaleMatrix, translation, scratchLocalTransform);

        const transform = Transforms.eastNorthUpToFixedFrame(this._position);

        this._model.modelMatrix = Matrix4.multiplyTransformation(transform, localTransform, new Matrix4());
    }

    flip() {
        Cartesian3.multiplyByScalar(this._normal, -1, this._normal);
        this._distance = -this._distance;
    }

    destroy() {
        this._removeCallback();

        this._scene.primitives.remove(this._model);

        destroyObject(this);
    }
}
