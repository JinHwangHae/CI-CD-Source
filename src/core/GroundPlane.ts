import {
    Cartesian2,
    Cartesian3,
    Color,
    ColorGeometryInstanceAttribute,
    GeometryInstance,
    Matrix4,
    PlaneGeometry,
    PerInstanceColorAppearance,
    Primitive,
    PrimitiveCollection,
    Scene,
    Transforms
} from "cesium";

import { AxisLinePrimitive } from "./primitives";
// eslint-disable-next-line
import getScreenSpaceScalingMatrix from "./getScreenSpaceScalingMatrix";
import { AssetGeoLocation } from "../types/common";
import { INITIAL_HEIGHT } from "./TilesetAsset";

interface GroundPlaneConstructorOptions {
    scene: Scene;
    size: number;
}

const upDirectionPixelSize = new Cartesian2(150, 150);
const upDirectionMaximumSizeInMeters = new Cartesian2(1 / 0, 1 / 0);
const scratchAxisLineModelMatrix = new Matrix4();

export class GroundPlane {
    private _longitude: number = 0; // in degree
    private _latitude: number = 0; // in degree
    private _altitude: number = INITIAL_HEIGHT; // in meter
    private _size: number;
    private _translationMatrix: Matrix4 | undefined;

    private readonly _scene: Scene;
    private readonly _primitiveCollection: PrimitiveCollection;
    private _groundPlane: Primitive | undefined;
    private _upDirectionArrow: AxisLinePrimitive;

    constructor(options: GroundPlaneConstructorOptions) {
        this._scene = options.scene;
        this._size = options.size;

        const primitiveCollection = new PrimitiveCollection();

        // @ts-ignore
        primitiveCollection.id = "GroundPlane-PrimitiveCollection";

        this._scene.primitives.add(primitiveCollection);

        this._primitiveCollection = primitiveCollection;

        this._createGroundPlane();

        const p1 = new Cartesian3(0, 0, 0);
        const p2 = new Cartesian3(0, 0, 1);

        this._upDirectionArrow = new AxisLinePrimitive({
            positions: [p1, p2],
            color: Color.PURPLE,
            arrow: true,
            loop: false,
            show: false,
            id: "Up"
        });

        this._primitiveCollection.add(this._upDirectionArrow);

        this._scene.preUpdate.addEventListener(this._update, this);
    }

    setGeolocation(location: AssetGeoLocation) {
        this._longitude = location.longitude;
        this._latitude = location.latitude;
        this._altitude = location.height;

        this._setPosition();
    }

    get longitude() {
        return this._longitude;
    }

    set longitude(val: number) {
        this._longitude = val;

        this._setPosition();
    }

    set latitude(val: number) {
        this._latitude = val;

        this._setPosition();
    }

    set altitude(val: number) {
        this._altitude = val;

        this._setPosition();
    }

    set show(val: boolean) {
        this._groundPlane!.show = val;
        this._upDirectionArrow.show = val;
    }

    _setPosition() {
        this._createGroundPlane();
    }

    _createGroundPlane() {
        const primitives = this._primitiveCollection;

        if (this._groundPlane) {
            primitives.remove(this._groundPlane);
        }

        const position = Cartesian3.fromDegrees(this._longitude, this._latitude, this._altitude);
        this._translationMatrix = Transforms.eastNorthUpToFixedFrame(position);

        const size = this._size;
        const dimensions = new Cartesian3(size, size, 1);
        const scaleMatrix = Matrix4.fromScale(dimensions);

        const planeModelMatrix = Matrix4.multiply(this._translationMatrix, scaleMatrix, new Matrix4());

        const planeGeometry = new PlaneGeometry({
            vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT
        });

        const planeGeometryInstance = new GeometryInstance({
            geometry: planeGeometry,
            modelMatrix: planeModelMatrix,
            attributes: {
                color: ColorGeometryInstanceAttribute.fromColor(Color.GREY.withAlpha(0.4))
            }
        });

        this._groundPlane = primitives.add(
            new Primitive({
                show: false,
                geometryInstances: planeGeometryInstance,
                appearance: new PerInstanceColorAppearance({
                    closed: true
                }),
                allowPicking: true,
                asynchronous: false
            })
        );
    }

    _update() {
        let modelMatrix = this._translationMatrix!.clone(scratchAxisLineModelMatrix);

        modelMatrix = getScreenSpaceScalingMatrix(
            upDirectionPixelSize,
            upDirectionMaximumSizeInMeters,
            // @ts-ignore
            this._scene.frameState,
            modelMatrix,
            modelMatrix
        );

        this._upDirectionArrow.modelMatrix = modelMatrix;
    }
}
