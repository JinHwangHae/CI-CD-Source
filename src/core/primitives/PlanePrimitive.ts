import {
    BoundingSphere,
    Cartesian3,
    Cartesian4,
    Color,
    ColorGeometryInstanceAttribute,
    destroyObject,
    Event,
    // @ts-ignore
    FrameState,
    GeometryInstance,
    HeadingPitchRoll,
    Math as CesiumMath,
    Matrix3,
    Matrix4,
    PerInstanceColorAppearance,
    PlaneGeometry,
    PlaneOutlineGeometry,
    Primitive,
    Cartesian2,
    Transforms
} from "cesium";

const scratchAxis = new Cartesian3();
const scratchScale = new Cartesian3();
const scratchRotation = new Matrix3();
const scratchLocalTransform = new Matrix4();
const scratchRotation4 = new Matrix4();
const scratchRotationHPR3 = new Matrix3();
const scratchRotationHPR4 = new Matrix4();
const scratchScaleMatrix = new Matrix4();
const scratchRotationMatrix = new Matrix4();

export interface PlanePrimitiveConstructorOptions {
    position: Cartesian3;
    hpr?: HeadingPitchRoll;
    normal: Cartesian3;
    distance: number;
    dimensions: Cartesian2;
    color: Color;
}

export class PlanePrimitive {
    protected _show: boolean;
    protected _update: boolean;
    protected _primitive: Primitive | undefined;
    protected _outlinePrimitive: Primitive | undefined;
    protected _position: Cartesian3;
    protected _normal: Cartesian3; // in local coordinate
    protected _left: Cartesian3; // in local coordinate
    protected _up: Cartesian3; // in local coordinate

    protected _distance: number;
    protected _dimensions: Cartesian2;
    private _color: Color;
    private _worldNormal: Cartesian3;

    protected readonly _modelMatrix: Matrix4;
    private _positionChanged: Event = new Event();
    private _hpr: HeadingPitchRoll = new HeadingPitchRoll();
    private _hprChanged: Event = new Event();

    constructor(options: PlanePrimitiveConstructorOptions) {
        this._update = true;

        this._position = options.position;

        if (options.hpr) {
            this._hpr = options.hpr;
        }

        this._distance = options.distance;
        this._dimensions = options.dimensions;
        this._color = options.color;

        this._worldNormal = Cartesian3.clone(options.normal, new Cartesian3());

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

        let up = Cartesian3.clone(Cartesian3.UNIT_Z, new Cartesian3());

        if (CesiumMath.equalsEpsilon(Math.abs(Cartesian3.dot(up, normal)), 1.0, CesiumMath.EPSILON8)) {
            up = Cartesian3.clone(Cartesian3.UNIT_Y, up);
        }

        const left = Cartesian3.cross(up, normal, scratchAxis);
        up = Cartesian3.cross(normal, left, up);
        Cartesian3.normalize(left, left);
        Cartesian3.normalize(up, up);

        this._left = left;
        this._up = up;

        this._modelMatrix = Matrix4.clone(Matrix4.IDENTITY);

        this._show = true;
    }

    get show() {
        return this._show;
    }

    set show(show) {
        this._show = show;
    }

    get distance() {
        return this._distance;
    }

    set distance(val) {
        this._distance = val;
        this._update = true;
    }

    get primitive() {
        return this._primitive;
    }

    get color() {
        return this._color;
    }

    set color(color) {
        this._color = color;
        this._update = true;
    }

    get position() {
        return this._position;
    }

    set position(val) {
        Cartesian3.clone(val, this._position);
        this._update = true;
        // @ts-ignore
        this._positionChanged.raiseEvent(val);
    }

    get positionChanged() {
        return this._positionChanged;
    }

    get worldNormal() {
        return this._worldNormal;
    }

    set worldNormal(val) {
        this._worldNormal = val;
    }

    get dimensions() {
        return this._dimensions;
    }

    set dimensions(dimensions: Cartesian2) {
        this._dimensions = dimensions;
        this._update = true;
    }

    get normal() {
        return this._normal;
    }

    get left() {
        return this._left;
    }

    get up() {
        return this._up;
    }

    get hpr() {
        return this._hpr;
    }

    set hpr(hpr: HeadingPitchRoll) {
        this._hpr = hpr;
        this._update = true;

        // @ts-ignore
        this._hprChanged.raiseEvent(hpr);
    }

    get hprChanged() {
        return this._hprChanged;
    }

    _updateModelMatrix() {
        return this._computeModelMatrix(this._modelMatrix);
    }

    scaleMatrix(result: Matrix4) {
        const dimensions = this._dimensions;

        const scale = Cartesian3.fromElements(dimensions.x, dimensions.y, 1.0, scratchScale);

        return Matrix4.fromScale(scale, result);
    }

    _rotationMatrix(result: Matrix4) {
        const normal = this._normal;
        const up = this._up;
        const left = this._left;

        const rotationMatrix = scratchRotation;

        Matrix3.setColumn(rotationMatrix, 0, left, rotationMatrix);
        Matrix3.setColumn(rotationMatrix, 1, up, rotationMatrix);
        Matrix3.setColumn(rotationMatrix, 2, normal, rotationMatrix);

        const rotation = Matrix4.fromRotation(rotationMatrix, scratchRotation4);
        const rotationHPR3 = Matrix3.fromHeadingPitchRoll(this._hpr, scratchRotationHPR3);
        const rotationHPR4 = Matrix4.fromRotation(rotationHPR3, scratchRotationHPR4);

        return Matrix4.multiply(rotation, rotationHPR4, result);
    }

    translationMatrix(result: Matrix4) {
        /*
        const normal = this._normal;
        const up = this._up;
        const left = this._left;
        */

        /* way1
        const offsetX = Cartesian3.multiplyByScalar(left, offset.x, scratchOffsetX);
        const translationX = Matrix4.fromTranslation(offsetX, scratchTranslationX);

        const offsetY = Cartesian3.multiplyByScalar(up, offset.y, scratchOffsetY);
        const translationY = Matrix4.fromTranslation(offsetY, scratchTranslationY);

        const offsetZ = Cartesian3.multiplyByScalar(normal, offset.z - this._distance, scratchOffsetZ);
        const translationZ = Matrix4.fromTranslation(offsetZ, scratchTranslationZ);

        Matrix4.multiply(translationX, translationY, result);

        return Matrix4.multiply(result, translationZ, result);
        */

        /* way2
        const x = left.x * offset.x + up.x * offset.y + normal.x * (offset.z - this.distance);
        const y = left.y * offset.x + up.y * offset.y + normal.y * (offset.z - this.distance);
        const z = left.z * offset.x + up.z * offset.y + normal.z * (offset.z - this.distance);
        
        return Matrix4.fromTranslation(new Cartesian3(x, y, z), result);
        */

        const coeff = this._translationCoefficient(new Matrix4());

        const translation = Matrix4.multiplyByPointAsVector(
            coeff,
            new Cartesian3(0, 0, -this.distance),
            new Cartesian3()
        );

        return Matrix4.fromTranslation(translation, result);
    }

    _translationCoefficient(result: Matrix4) {
        const normal = this._normal;
        const up = this._up;
        const left = this._left;

        const v = [left.x, left.y, left.z, 0, up.x, up.y, up.z, 0, normal.x, normal.y, normal.z, 0, 0, 0, 0, 0];

        return Matrix4.fromArray(v, 0, result);
    }

    _computeModelMatrix(result: Matrix4) {
        const scaleMatrix = this.scaleMatrix(scratchScaleMatrix);
        const rotationMatrix = this._rotationMatrix(scratchRotationMatrix);
        const translationMatrix = this.translationMatrix(scratchLocalTransform);

        Matrix4.multiply(translationMatrix, rotationMatrix, scratchLocalTransform);
        Matrix4.multiply(scratchLocalTransform, scaleMatrix, scratchLocalTransform);

        const transform = Transforms.eastNorthUpToFixedFrame(this._position);

        return Matrix4.multiplyTransformation(transform, scratchLocalTransform, result);
    }

    update(frameState: FrameState) {
        if (!this._show) {
            return;
        }

        if (this._update) {
            this._update = false;

            if (this._primitive) this._primitive.destroy();

            this._updateModelMatrix();

            const planeGeometry = new PlaneGeometry({
                vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT
            });

            const planeGeometryInstance = new GeometryInstance({
                geometry: planeGeometry,
                modelMatrix: this._modelMatrix,
                attributes: {
                    color: ColorGeometryInstanceAttribute.fromColor(this._color)
                }
            });

            this._primitive = new Primitive({
                show: true,
                geometryInstances: planeGeometryInstance,
                appearance: new PerInstanceColorAppearance({
                    closed: true
                }),
                allowPicking: true,
                asynchronous: false
            });

            const planeOutlineGeometry = new PlaneOutlineGeometry();

            const planeOutlineGeometryInstance = new GeometryInstance({
                geometry: planeOutlineGeometry,
                modelMatrix: this._modelMatrix,
                attributes: {
                    color: ColorGeometryInstanceAttribute.fromColor(Color.WHITE)
                }
            });

            this._outlinePrimitive = new Primitive({
                show: true,
                geometryInstances: planeOutlineGeometryInstance,
                appearance: new PerInstanceColorAppearance({
                    flat: true
                }),
                allowPicking: false,
                asynchronous: false
            });
        }

        // @ts-ignore
        this._primitive!.update(frameState);
        // @ts-ignore
        this._outlinePrimitive!.update(frameState);
    }

    flip() {
        Cartesian3.multiplyByScalar(this._worldNormal, -1, this._worldNormal);

        const transform = Transforms.eastNorthUpToFixedFrame(this._position);

        const invTransform = Matrix4.inverseTransformation(transform, new Matrix4());

        const normal = Matrix4.multiplyByVector(
            invTransform,
            new Cartesian4(this._worldNormal.x, this._worldNormal.y, this._worldNormal.z, 0),
            new Cartesian4()
        );

        Cartesian3.clone(normal, this._normal);

        this._distance = -this._distance;
        this._update = true;
    }

    get modelMatrix() {
        return this._modelMatrix;
    }

    forceUpdate() {
        this._update = true;
    }

    getBoundingSphere(result: BoundingSphere) {
        if (!this._primitive) {
            return result;
        }

        const dimensions = this.dimensions;
        Cartesian3.clone(this._position, result.center);
        result.radius = Math.max(dimensions.x, dimensions.y);

        return result;
    }

    destroy() {
        if (this._primitive) {
            this._primitive.destroy();
        }

        return destroyObject(this);
    }
}
