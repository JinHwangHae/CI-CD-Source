import {
    AxisAlignedBoundingBox,
    BoxGeometry,
    BoxOutlineGeometry,
    BoundingSphere,
    Cartesian3,
    Cartographic,
    Cesium3DTileset,
    Color,
    ColorGeometryInstanceAttribute,
    CustomShader,
    DeveloperError,
    DebugModelMatrixPrimitive,
    Ellipsoid,
    Event,
    GeometryInstance,
    HeadingPitchRoll,
    Math as CesiumMath,
    Matrix3,
    Matrix4,
    OrientedBoundingBox,
    PerInstanceColorAppearance,
    Primitive,
    PrimitiveCollection,
    Quaternion,
    Scene,
    SplitDirection,
    Transforms,
    UniformType
} from "cesium";

import { AssetGeoLocation, ConstruktedAssetType } from "../types/common";
import {
    georeferencedAtECEF,
    updateModelMatrixOfTilesetDefinedAtLocal,
    updateModelMatrixOfTilesetDefinedAtECEF
} from "./georeferencing";
import createQuaternionFromUnitVectors from "./createQuaternionFromUnitVectors";
import { Asset } from "./Asset";
import { calculateTightBoundinSphere } from "../calculateTightBoundingSphere";

export enum TilesetAssetShadingModes {
    Wireframe = "Wireframe",
    Solid = "Solid",
    Texture = "Texture"
}

interface AssetConstructorOptions {
    type: ConstruktedAssetType;
    postId: string;
    scene: Scene;
    assetGeolocation: AssetGeoLocation | undefined;
    ignore_original_transform: boolean;
    tilesetUrl: string;
    ignoreRootTransform: boolean;
}

export const INITIAL_HEIGHT = 0;
const INITIAL_POSITION = Cartesian3.fromDegrees(0, 0, INITIAL_HEIGHT, Ellipsoid.WGS84, new Cartesian3());

export class TilesetAsset extends Asset {
    private readonly _scene: Scene;
    // this is used for only initializing geo location of asset
    private readonly _initialGeolocation: AssetGeoLocation | undefined;

    /**
     * in mose cases tileset.boundingSphere is not tight as reported at #1179
     */
    private readonly _tightBoundingSphere = new BoundingSphere();

    /*
     * can be initialized when pre or visual editor is activated.
     * unset when pre or visual editor is deactivated.
     */

    private _geoRef = new Cartesian3();
    private _geoRefAtLocal = new Cartesian3();
    private _tileset: Cesium3DTileset | undefined;

    private _originallyGeoreferencedAtECEF: boolean;
    private _ignoreOriginalTransform: boolean;
    private _ignoreRootTransform: boolean;

    // necessary to get original geo location
    private _origRootBoundingVolume: OrientedBoundingBox | BoundingSphere | undefined;

    private readonly _position: Cartesian3 = new Cartesian3();

    /**
     * why need to introduce?
     *
     * https://en.wikipedia.org/wiki/Rotation_matrix
     * there is no way to calculate these from modelMatrix of tileset
     */
    private _heading: number = 0; // in radian
    private _pitch: number = 0; // in radian
    private _roll: number = 0; // in radian
    private _scale: number = 1.0;

    private readonly _loadProgress = new Event();

    // fired when position is changed by setOneOfBLH
    // fired when position is changed by geolocation ref
    private readonly _positionChanged: Event = new Event();

    private readonly _geolocationChanged: Event = new Event();

    private readonly _geoRefChanged: Event = new Event();

    private readonly _elevationRefChanged: Event = new Event();

    private _positionDebugModelMatrixPrimitive: DebugModelMatrixPrimitive | undefined;
    private readonly _debug = false;

    private _percentOfLoadingProgress = 0.0;

    private _aabbox: Primitive | undefined;
    private _aabboxOutline: Primitive | undefined;
    private _primitiveCollection: PrimitiveCollection;

    constructor(options: AssetConstructorOptions) {
        super(options);
        this._scene = options.scene;
        this._initialGeolocation = options.assetGeolocation;
        this._ignoreOriginalTransform = options.ignore_original_transform;
        this._originallyGeoreferencedAtECEF = false;
        this._ignoreRootTransform = options.ignoreRootTransform;

        const primitiveCollection = new PrimitiveCollection();

        // @ts-ignore
        primitiveCollection.id = "TilesetAsset-PrimitiveCollection";

        this._primitiveCollection = primitiveCollection;

        options.scene.primitives.add(primitiveCollection);

        // for testing when offline
        // options.tilesetUrl = "http://localhost:1217/3DTiles/ak3jqkwtmpv/tileset.json";

        const tilesetPromise = Cesium3DTileset.fromUrl(options.tilesetUrl, {
            immediatelyLoadDesiredLevelOfDetail: false,
            skipLevelOfDetail: true,
            loadSiblings: true,
            debugShowBoundingVolume: false,
            cacheBytes: 512 * 1024 * 1024,
            maximumCacheOverflowBytes: 256 * 1024 * 1024
        });

        tilesetPromise
            .then((tileset: Cesium3DTileset) => {
                // Model level of detail
                tileset.maximumScreenSpaceError = 8.0; // Default is 16

                tileset.pointCloudShading.maximumAttenuation = 3; // Don't allow points larger than 4 pixels.
                tileset.pointCloudShading.baseResolution = 0.44; // Assume an original capture resolution of 5 centimeters between neighboring points.
                tileset.pointCloudShading.geometricErrorScale = 0.3; // Applies to both geometric error and the base resolution.
                tileset.pointCloudShading.attenuation = true;
                tileset.pointCloudShading.eyeDomeLighting = true;
                tileset.pointCloudShading.eyeDomeLightingStrength = 0.5;
                tileset.pointCloudShading.eyeDomeLightingRadius = 0.5;

                this._tileset = tileset;

                if (this._ignoreRootTransform) {
                    tileset.root.transform = Matrix4.IDENTITY;
                    this._scene.primitives.add(tileset);
                    setTimeout(() => {
                        this._onTilesetReady();
                        this.updateTightBoundingSphere();
                        this._ready = true;
                        this._readyEvt.raiseEvent();
                    }, 1000);
                } else {
                    this._onTilesetReady();
                    this.updateTightBoundingSphere();
                    this._ready = true;
                    this._readyEvt.raiseEvent();
                }
            })
            .catch((error: any) => {
                console.error(error);
            });
    }

    getRefereceFrame(result: Matrix4 | undefined) {
        const origin = this.originqq;

        return Transforms.eastNorthUpToFixedFrame(origin, Ellipsoid.WGS84, result);
    }

    get tileset() {
        return this._tileset!;
    }

    get loadProgress() {
        return this._loadProgress;
    }

    get positionChanged() {
        return this._positionChanged;
    }

    get geolocationChanged() {
        return this._geolocationChanged;
    }

    get elevationRefChanged() {
        return this._elevationRefChanged;
    }

    get originallyGeoreferencedAtECEF() {
        return this._originallyGeoreferencedAtECEF;
    }

    get tightBoundingSphere() {
        return this._tightBoundingSphere;
    }

    get transformedTightBoundingSphereCenter() {
        const delta = Cartesian3.subtract(this._position, this.originqq, new Cartesian3());
        return Cartesian3.add(this._tightBoundingSphere.center, delta, new Cartesian3());
    }

    updateTightBoundingSphere() {
        const tightBoundingSphere = calculateTightBoundinSphere(this._tileset!);

        BoundingSphere.clone(tightBoundingSphere, this._tightBoundingSphere);
    }

    _doGeoreference() {
        const tileset = this.tileset;
        const position = this._position;
        const hpr = this.hpr;
        const scale = this.scale;

        const rotationOffsetCenter = new Cartesian3();

        if (this._originallyGeoreferencedAtECEF) {
            if (this.hasValidGeoRef()) {
                updateModelMatrixOfTilesetDefinedAtECEF({
                    tileset: tileset,
                    position: position,
                    rotateCenter: undefined,
                    geoRefAtLocal: this._geoRefAtLocal,
                    hpr: hpr,
                    scale: scale
                });
            } else {
                updateModelMatrixOfTilesetDefinedAtECEF({
                    tileset: tileset,
                    position: position,
                    rotateCenter: this.transformedTightBoundingSphereCenter,
                    geoRefAtLocal: undefined,
                    hpr: hpr,
                    scale: scale
                });
            }
        } else {
            updateModelMatrixOfTilesetDefinedAtLocal(tileset, position, rotationOffsetCenter, hpr, scale);
        }

        if (this.hasValidGeoRef()) {
            this._updateGeoRef();
        }

        this._geolocationChanged.raiseEvent();

        if (this._positionDebugModelMatrixPrimitive) {
            this._positionDebugModelMatrixPrimitive.modelMatrix = Transforms.eastNorthUpToFixedFrame(position);
        }
    }

    georeference(geolocation: AssetGeoLocation) {
        const cartographic = Cartographic.fromDegrees(geolocation.longitude, geolocation.latitude, geolocation.height);
        const position = Ellipsoid.WGS84.cartographicToCartesian(cartographic);

        position.clone(this._position);

        this._heading = CesiumMath.toRadians(geolocation.heading);
        this._pitch = CesiumMath.toRadians(geolocation.pitch);
        this._roll = CesiumMath.toRadians(geolocation.roll);

        this._scale = geolocation.scale.x;

        if (geolocation.localGeoRefX) {
            this._geoRefAtLocal.x = geolocation.localGeoRefX;
        }

        if (geolocation.localGeoRefY) {
            this._geoRefAtLocal.y = geolocation.localGeoRefY;
        }

        if (geolocation.localGeoRefZ) {
            this._geoRefAtLocal.z = geolocation.localGeoRefZ;
        }

        this._doGeoreference();
    }

    /**
     *
     * @param longitude in degree
     * @param latitude  in degree
     * @param height in meter
     */
    setOneOfBLH(longitude: number | undefined, latitude: number | undefined, height: number | undefined) {
        const geolocation = this.calculateGeolocation();

        if (longitude) {
            geolocation.longitude = longitude;
        }

        if (latitude) {
            geolocation.latitude = latitude;
        }

        if (height) {
            geolocation.height = height;
        }

        this.georeference(geolocation);

        // @ts-ignore
        this._positionChanged.raiseEvent(this._position);
    }

    setGeoRef(position: Cartesian3, affectOnlyHeight: boolean) {
        this._updateGeoRefLocal(position, affectOnlyHeight);

        this._doGeoreference();

        if (affectOnlyHeight) {
            const carto = Cartographic.fromCartesian(position);

            const height = this._scene.sampleHeight(carto);

            const elevationRef = Cartesian3.fromRadians(carto.longitude, carto.latitude, height);

            // @ts-ignore
            this._elevationRefChanged.raiseEvent(elevationRef);
        }
    }

    _updateGeoRefLocal(position: Cartesian3, affectOnlyHeight: boolean) {
        const worldToLocal = this.worldToLocalMatrix(new Matrix4());

        Matrix4.multiplyByPoint(worldToLocal, position, this._geoRefAtLocal);

        if (affectOnlyHeight) {
            this._geoRefAtLocal.x = 0;
            this._geoRefAtLocal.y = 0;
        }
    }

    _updateGeoRef() {
        const localToWorld = this.localToWorldMatrix(new Matrix4());

        const tmp = Matrix4.multiplyByPoint(localToWorld, this._geoRefAtLocal, new Cartesian3());

        if (!Cartesian3.equals(this._geoRef, tmp)) {
            Cartesian3.clone(tmp, this._geoRef);

            // @ts-ignore
            this._geoRefChanged.raiseEvent(this._geoRef);
        }
    }

    get geoRefChanged() {
        return this._geoRefChanged;
    }

    hasValidGeoRef() {
        return !Cartesian3.ZERO.equals(this._geoRefAtLocal);
    }

    get geoRef() {
        return this._geoRef;
    }

    placeOnTerrain(longitude: number, latitude: number, terrainHeight: number) {
        const tileset = this._tileset;

        // @ts-ignore
        const boundingVolume = tileset.root.boundingVolume.boundingVolume;

        const boundingVolumeCenterCartographic = Cartographic.fromCartesian(boundingVolume.center);

        let deltaHeight = 0;

        if (this.hasValidGeoRef()) {
            // After an Geolocation Reference has been established, the "Place on terrain" should place the dot on the terrain

            const carto = Cartographic.fromCartesian(this._geoRef);

            deltaHeight = terrainHeight - carto.height;

            this._geoRef = Cartesian3.fromRadians(carto.longitude, carto.latitude, terrainHeight);
            // @ts-ignore
            this._geoRefChanged.raiseEvent(this._geoRef);
        } else if (boundingVolume instanceof OrientedBoundingBox) {
            let zRadius =
                boundingVolume.halfAxes[6] * boundingVolume.halfAxes[6] +
                boundingVolume.halfAxes[7] * boundingVolume.halfAxes[7] +
                boundingVolume.halfAxes[8] * boundingVolume.halfAxes[8];
            zRadius = Math.sqrt(zRadius);

            const boundingBoxBottomHeight = boundingVolumeCenterCartographic.height - zRadius;
            deltaHeight = terrainHeight - boundingBoxBottomHeight;
        } else if (boundingVolume instanceof BoundingSphere) {
            const boundingBoxBottomHeight = boundingVolumeCenterCartographic.height - boundingVolume.radius;

            deltaHeight = terrainHeight - boundingBoxBottomHeight;
        } else {
            console.error("error");
        }

        if (CesiumMath.equalsEpsilon(deltaHeight, 0, CesiumMath.EPSILON1)) {
            return;
        }

        this._extrude(deltaHeight);

        this.updateTightBoundingSphere();

        // @ts-ignore
        this._positionChanged.raiseEvent(this._position);
    }

    height() {
        const tileset = this.tileset;

        if (this._originallyGeoreferencedAtECEF) {
            const carto = Cartographic.fromCartesian(tileset.boundingSphere.center);

            return carto.height;
        }

        const position = Matrix4.getTranslation(tileset.modelMatrix, new Cartesian3());
        const carto = Cartographic.fromCartesian(position);

        return carto.height;
    }

    heightOfGeoRef() {
        const carto = Cartographic.fromCartesian(this._geoRef);

        return carto.height;
    }

    _extrude(deltaHeight: number) {
        const geolocation = this.calculateGeolocation();
        geolocation.height += deltaHeight;
        this.georeference(geolocation);
    }

    worldToLocalMatrix(result: Matrix4) {
        const tileset = this.tileset;

        if (!this._originallyGeoreferencedAtECEF) {
            return Matrix4.inverse(tileset.modelMatrix, result);
        }

        const referenceFrame = this.getRefereceFrame(new Matrix4());

        Matrix4.inverseTransformation(referenceFrame, result);

        const invModelMatrix = Matrix4.inverse(tileset.modelMatrix, new Matrix4());

        Matrix4.multiply(result, invModelMatrix, result);

        return result;
    }

    localToWorldMatrix(result: Matrix4) {
        const tileset = this.tileset;

        if (!this._originallyGeoreferencedAtECEF) {
            return tileset.modelMatrix.clone(result);
        }

        this.getRefereceFrame(result);

        return Matrix4.multiply(tileset.modelMatrix, result, result);
    }

    // rotate asset so that the local up direction coincides with the given direction
    rotate(direction: Cartesian3) {
        const worldToLocal = this.worldToLocalMatrix(new Matrix4());
        const directionInLocal = Matrix4.multiplyByPointAsVector(worldToLocal, direction, new Cartesian3());
        Cartesian3.normalize(directionInLocal, directionInLocal);

        const rotation = createQuaternionFromUnitVectors(directionInLocal, Cartesian3.UNIT_Z);
        const geolocation = this.calculateGeolocation();
        const hpr = HeadingPitchRoll.fromQuaternion(rotation);

        // keep old heading
        // geolocation.heading = CesiumMath.toDegrees(hpr.heading);
        geolocation.pitch = CesiumMath.toDegrees(hpr.pitch);
        geolocation.roll = CesiumMath.toDegrees(hpr.roll);

        this.georeference(geolocation);
    }

    initialGeoreference() {
        const tileset = this.tileset;

        const geolocation = this._initialGeolocation;

        if (geolocation) {
            this.georeference(geolocation);
        } else if (this._originallyGeoreferencedAtECEF) {
            if (this._ignoreOriginalTransform) {
                INITIAL_POSITION.clone(this._position);
                tileset.modelMatrix = Transforms.eastNorthUpToFixedFrame(this._position);
            } else {
                tileset.boundingSphere.center.clone(this._position);
            }

            if (this._positionDebugModelMatrixPrimitive) {
                this._positionDebugModelMatrixPrimitive.modelMatrix = Transforms.eastNorthUpToFixedFrame(
                    this._position
                );
            }
        } else {
            Cartesian3.fromDegrees(0, 0, INITIAL_HEIGHT, Ellipsoid.WGS84, this._position);
            tileset.modelMatrix = Transforms.eastNorthUpToFixedFrame(this._position);

            if (this._positionDebugModelMatrixPrimitive) {
                this._positionDebugModelMatrixPrimitive.modelMatrix = Transforms.eastNorthUpToFixedFrame(
                    this._position
                );
            }
        }
    }

    get georeferenced() {
        return !INITIAL_POSITION.equals(this._position);
    }

    get originqq() {
        const tileset = this.tileset;
        const modelMatrix = tileset.modelMatrix;

        if (!this._originallyGeoreferencedAtECEF) {
            return Matrix4.getTranslation(modelMatrix, new Cartesian3());
        }

        // originally georeferenced at ECEF
        return this._origRootBoundingVolume?.center!;
    }

    get position() {
        return this._position;
    }

    set position(position: Cartesian3) {
        position.clone(this._position);

        this._doGeoreference();
    }

    moveTightBoundingSphere(position: Cartesian3) {
        const delta = Cartesian3.subtract(this._tightBoundingSphere.center, this.originqq, new Cartesian3());

        const assetPosition = Cartesian3.subtract(position, delta, new Cartesian3());

        this.position = assetPosition;
    }

    get hpr() {
        return new HeadingPitchRoll(this._heading, this._pitch, this._roll);
    }

    set hpr(hpr: HeadingPitchRoll) {
        this._heading = hpr.heading;
        this._pitch = hpr.pitch;
        this._roll = hpr.roll;

        this._doGeoreference();
    }

    set scale(scale: Cartesian3) {
        this._scale = scale.x;
        this._doGeoreference();
    }

    get scale() {
        return new Cartesian3(this._scale, this._scale, this._scale);
    }

    calculateGeolocation(round = false) {
        const cartographic = Cartographic.fromCartesian(this._position);
        const scale = this._scale;
        const geoRefAtLocal = this._geoRefAtLocal;

        if (!round) {
            return {
                longitude: CesiumMath.toDegrees(cartographic.longitude),
                latitude: CesiumMath.toDegrees(cartographic.latitude),
                height: cartographic.height,
                localGeoRefX: geoRefAtLocal.x,
                localGeoRefY: geoRefAtLocal.y,
                localGeoRefZ: geoRefAtLocal.z,
                heading: CesiumMath.toDegrees(this._heading),
                pitch: CesiumMath.toDegrees(this._pitch),
                roll: CesiumMath.toDegrees(this._roll),
                scale: {
                    x: scale,
                    y: scale,
                    z: scale
                }
            };
        }

        const digit = 2;
        const scaleDigit = 5;

        return {
            longitude: CesiumMath.toDegrees(cartographic.longitude),
            latitude: CesiumMath.toDegrees(cartographic.latitude),
            height: parseFloat(cartographic.height.toFixed(digit)),
            localGeoRefX: parseFloat(geoRefAtLocal.x.toFixed(digit)),
            localGeoRefY: parseFloat(geoRefAtLocal.y.toFixed(digit)),
            localGeoRefZ: parseFloat(geoRefAtLocal.z.toFixed(digit)),
            heading: parseFloat(CesiumMath.toDegrees(this._heading).toFixed(digit)),
            pitch: parseFloat(CesiumMath.toDegrees(this._pitch).toFixed(digit)),
            roll: parseFloat(CesiumMath.toDegrees(this._roll).toFixed(digit)),
            scale: {
                x: parseFloat(scale.toFixed(scaleDigit)),
                y: parseFloat(scale.toFixed(scaleDigit)),
                z: parseFloat(scale.toFixed(scaleDigit))
            }
        };
    }

    _onTilesetReady() {
        const tileset = this.tileset;

        // @ts-ignore
        const boundingVolume = tileset.root.boundingVolume.boundingVolume;

        if (boundingVolume instanceof OrientedBoundingBox) {
            this._origRootBoundingVolume = OrientedBoundingBox.clone(boundingVolume, new OrientedBoundingBox());
        } else if (boundingVolume instanceof BoundingSphere) {
            this._origRootBoundingVolume = BoundingSphere.clone(boundingVolume, new BoundingSphere());
        } else {
            throw new DeveloperError("unexpected bounding volume");
        }

        if (georeferencedAtECEF(tileset)) {
            this._originallyGeoreferencedAtECEF = true;
        }

        this._scene.primitives.add(tileset);

        if (this._debug) {
            this._positionDebugModelMatrixPrimitive = this._primitiveCollection.add(
                new DebugModelMatrixPrimitive({
                    modelMatrix: Matrix4.IDENTITY,
                    length: tileset.boundingSphere.radius * 1.5,
                    width: 3
                })
            );
        }

        this.initialGeoreference();

        let maxOfNumberOfTilesProcessing = 0;

        tileset.loadProgress.addEventListener((numberOfPendingRequests, numberOfTilesProcessing) => {
            if (numberOfPendingRequests === 0 && numberOfTilesProcessing === 0) {
                maxOfNumberOfTilesProcessing = 0;
            }

            if (maxOfNumberOfTilesProcessing < numberOfTilesProcessing) {
                maxOfNumberOfTilesProcessing = numberOfTilesProcessing;
            }

            if (maxOfNumberOfTilesProcessing === 0) {
                this._percentOfLoadingProgress = 100;
                return;
            }

            this._percentOfLoadingProgress = (1 - numberOfTilesProcessing / maxOfNumberOfTilesProcessing) * 100;

            // @ts-ignore
            this._loadProgress.raiseEvent(this._percentOfLoadingProgress);
        });

        setTimeout(() => {
            // need to wait for tileset.root._boundingVolume or _contentBoundingVolume are updated by cesium's rendering loop.

            // refer to TileOrientedBoundingBox.prototype.createDebugVolume

            // @ts-ignore
            let orientiedBoundingBox = tileset.root._boundingVolume._orientedBoundingBox;

            // @ts-ignore
            if (tileset.root._contentBoundingVolume) {
                // @ts-ignore
                orientiedBoundingBox = tileset.root._contentBoundingVolume._orientedBoundingBox;
            }

            const modelMatrix = Matrix4.fromRotationTranslation(
                orientiedBoundingBox.halfAxes,
                orientiedBoundingBox.center
            );

            this._aabbox = this._primitiveCollection.add(
                new Primitive({
                    show: false,
                    geometryInstances: new GeometryInstance({
                        geometry: new BoxGeometry({
                            // Make a 2x2x2 cube
                            minimum: new Cartesian3(-1.0, -1.0, -1.0),
                            maximum: new Cartesian3(1.0, 1.0, 1.0)
                        }),
                        modelMatrix: modelMatrix,
                        attributes: {
                            color: ColorGeometryInstanceAttribute.fromColor(Color.RED.withAlpha(0.2))
                        }
                    }),
                    appearance: new PerInstanceColorAppearance({
                        closed: true
                    })
                })
            );

            this._aabboxOutline = this._primitiveCollection.add(
                new Primitive({
                    show: false,
                    geometryInstances: new GeometryInstance({
                        geometry: new BoxOutlineGeometry({
                            // Make a 2x2x2 cube
                            minimum: new Cartesian3(-1.0, -1.0, -1.0),
                            maximum: new Cartesian3(1.0, 1.0, 1.0)
                        }),
                        modelMatrix: modelMatrix,
                        attributes: {
                            color: ColorGeometryInstanceAttribute.fromColor(Color.YELLOW)
                        }
                    }),
                    appearance: new PerInstanceColorAppearance({
                        translucent: false,
                        flat: true
                    })
                })
            );
        }, 1000);
    }

    showHideBox(show: boolean) {
        this._aabbox!.show = show;
        this!._aabboxOutline!.show = show;
    }

    originalGeolocation() {
        console.assert(this._originallyGeoreferencedAtECEF, "error");

        const carto = Cartographic.fromCartesian(this._origRootBoundingVolume?.center!);

        return {
            longitude: CesiumMath.toDegrees(carto.longitude),
            latitude: CesiumMath.toDegrees(carto.latitude),
            height: carto.height,
            heading: 0,
            pitch: 0,
            roll: 0,
            scale: {
                x: 1,
                y: 1,
                z: 1
            }
        };
    }

    percentOfLoadedTiles() {
        // @ts-ignore
        const statistics = this._tileset.statistics;

        return (statistics.numberOfLoadedTilesTotal / statistics.numberOfTilesTotal) * 100;
    }

    get percentOfLoadingProgress() {
        return this._percentOfLoadingProgress;
    }

    setSplitDirection(leftChecked: boolean, rightChecked: boolean) {
        const tileset = this.tileset;

        if (rightChecked && leftChecked) {
            // @ts-ignore
            tileset.splitDirection = undefined;
            tileset.show = true;
            return;
        }

        if (!rightChecked && !leftChecked) {
            // @ts-ignore
            tileset.splitDirection = undefined;
            tileset.show = false;
            return;
        }

        tileset.show = true;

        if (rightChecked) {
            // @ts-ignore
            tileset.splitDirection = SplitDirection.RIGHT;
        } else {
            // @ts-ignore
            tileset.splitDirection = SplitDirection.LEFT;
        }
    }

    toggle() {
        const tileset = this.tileset;
        tileset.show = !tileset.show;
    }

    setShowSplitDirection(show: boolean, splitDirection: SplitDirection) {
        const tileset = this.tileset;
        tileset.show = show;
        // @ts-ignore
        tileset.splitDirection = splitDirection;
    }

    resetShowSplitDirection() {
        const tileset = this.tileset;
        tileset.show = true;
        // @ts-ignore
        tileset.splitDirection = undefined;
    }

    setShadingMode(mode: TilesetAssetShadingModes) {
        const tileset = this.tileset;

        if (mode === TilesetAssetShadingModes.Wireframe) {
            tileset.debugWireframe = true;
            tileset.customShader = undefined;
        } else if (mode === TilesetAssetShadingModes.Solid) {
            tileset.debugWireframe = false;

            const pivotNormal = Cartesian3.normalize(tileset.boundingSphere.center, new Cartesian3());

            const fragmentShaderText = `
            void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material)
            {
              vec3 v_positionEC = fsInput.attributes.positionEC;

              // https://community.khronos.org/t/getting-the-normal-with-dfdx-and-dfdy/70177

              /*
                dFdx and dFdy return approximations to the derivatives of their arguments.
                Applying them to a position on a surface returns a tangent to that surface.
                As the cross-product of two vectors is perpendicular to both vectors,
                the cross-product of two tangents is normal to the surface.
              */

              vec3 posvn = v_positionEC.xyz;
              vec3 nffy = dFdy(posvn);
              vec3 nffx = dFdx(posvn);
              vec3 nEC = normalize(cross(nffx, nffy));
              
              float nDotL = dot(u_pivotNormal, (czm_inverseNormal * nEC));
             
              nDotL = abs(nDotL);
              nDotL = clamp(nDotL, 0.0, 1.0);

              material.diffuse = vec3(1.0 * nDotL);
            }
            `;

            const solidCustomShader = new CustomShader({
                uniforms: {
                    u_pivotNormal: {
                        value: pivotNormal,
                        type: UniformType.VEC3
                    }
                },
                fragmentShaderText: fragmentShaderText
            });

            tileset.customShader = solidCustomShader;
        } else if (mode === TilesetAssetShadingModes.Texture) {
            tileset.debugWireframe = false;
            tileset.customShader = undefined;
        }
    }

    getAABoundingBox(result: AxisAlignedBoundingBox) {
        const tileset = this.tileset;

        // @ts-ignore
        const boundingVolume = tileset.root.boundingVolume.boundingVolume;
        const positions: Cartesian3[] = [];

        if (boundingVolume instanceof OrientedBoundingBox) {
            const corners = OrientedBoundingBox.computeCorners(boundingVolume);

            corners.forEach((corner: Cartesian3) => {
                positions.push(corner);
            });
        } else if (boundingVolume instanceof BoundingSphere) {
            const center = boundingVolume.center;
            const radius = boundingVolume.radius;

            const min = new Cartesian3(center.x - radius, center.y - radius, center.z - radius);
            const max = new Cartesian3(center.x + radius, center.y + radius, center.z + radius);

            return new AxisAlignedBoundingBox(min, max, center);
        } else {
            throw new DeveloperError("unexpected boundingVolume");
        }

        return AxisAlignedBoundingBox.fromPoints(positions, result);
    }

    getMinimumHeight() {
        const tileset = this.tileset;

        // @ts-ignore
        const boundingVolume = tileset.root.boundingVolume.boundingVolume;

        let minHeight = 8848;

        if (boundingVolume instanceof OrientedBoundingBox) {
            const corners = OrientedBoundingBox.computeCorners(boundingVolume);

            corners.forEach((cartesian: Cartesian3) => {
                const carto = Cartographic.fromCartesian(cartesian);

                if (carto.height < minHeight) {
                    minHeight = carto.height;
                }
            });
        } else if (boundingVolume instanceof BoundingSphere) {
            const center = boundingVolume.center;

            const carto = Cartographic.fromCartesian(center);

            const radius = boundingVolume.radius;

            minHeight = carto.height - radius;
        } else {
            throw new DeveloperError("unexpected boundingVolume");
        }

        return minHeight;
    }

    georeferenceByMatrix4(matrix: Matrix4) {
        const position = Matrix4.getTranslation(matrix, new Cartesian3());

        const toWorld = Transforms.eastNorthUpToFixedFrame(position);
        const inverseTWorld = Matrix4.inverse(toWorld, new Matrix4());

        const scale = Matrix4.getScale(matrix, new Cartesian3());

        /* this does not work
        const rotation = Matrix4.getRotation(matrix, new Matrix3());
        */

        const tmp = Matrix4.multiply(inverseTWorld, matrix, new Matrix4());
        const rotation = Matrix4.getRotation(tmp, new Matrix3());

        const quaternion = Quaternion.fromRotationMatrix(rotation);
        const hpr = HeadingPitchRoll.fromQuaternion(quaternion);

        position.clone(this._position);

        this._heading = hpr.heading;
        this._pitch = hpr.pitch;
        this._roll = hpr.roll;

        this._scale = scale.x;

        this._doGeoreference();
    }

    getDimensions() {
        const tileset = this._tileset;

        // @ts-ignore
        const boundingVolume = tileset.root.boundingVolume.boundingVolume;

        if (boundingVolume instanceof OrientedBoundingBox) {
            const orientedBoundingBox = boundingVolume as OrientedBoundingBox;

            const halfAxes = orientedBoundingBox.halfAxes;

            let xAxisHalfLength = halfAxes[0] * halfAxes[0] + halfAxes[1] * halfAxes[1] + halfAxes[2] * halfAxes[2];
            let yAxisHalfLength = halfAxes[3] * halfAxes[3] + halfAxes[4] * halfAxes[4] + halfAxes[5] * halfAxes[5];
            let zAxisHalfLength = halfAxes[6] * halfAxes[6] + halfAxes[7] * halfAxes[7] + halfAxes[8] * halfAxes[8];

            xAxisHalfLength = Math.sqrt(xAxisHalfLength);
            yAxisHalfLength = Math.sqrt(yAxisHalfLength);
            zAxisHalfLength = Math.sqrt(zAxisHalfLength);

            return {
                x: xAxisHalfLength * 2,
                y: yAxisHalfLength * 2,
                z: zAxisHalfLength * 2
            };
        }

        if (boundingVolume instanceof BoundingSphere) {
            const radius = boundingVolume.radius;

            return {
                x: radius * 2,
                y: radius * 2,
                z: radius * 2
            };
        }

        throw new DeveloperError("unexpected boundingVolume");
    }

    removeGeoreference() {
        this.tileset.modelMatrix = Matrix4.IDENTITY;

        this._geolocationChanged.raiseEvent();
    }
}
