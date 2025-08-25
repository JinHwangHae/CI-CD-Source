/* qeslint-disable */
// q@ts-nocheck

import {
    Cartesian2,
    Cartesian3,
    Cartographic,
    Color,
    destroyObject,
    HorizontalOrigin,
    LabelCollection,
    LabelStyle,
    Math as CesiumMath,
    Matrix4,
    Primitive,
    PrimitiveCollection,
    Scene,
    Transforms,
    VerticalOrigin
} from "cesium";

// @ts-ignore
import * as pointInPolygonModule from "point-in-polygon";
import * as turf from "@turf/turf";

import { createMeshPrimitive } from "../../../core";
import { GridVerticesContainer } from "./GridVerticesContainer";

const pointInPolygon = pointInPolygonModule.default;

interface GridMeshConstructorOptions {
    scene: Scene;
    polygonPositions: Array<Cartesian3>;
    gridCellSize: number;
    deltaHeight: number;
    primitiveCollection: PrimitiveCollection;
    clampedGridPositions: Cartesian3[] | undefined;
}

class GridMesh {
    private readonly _polygonPositions: Array<Cartesian3>;
    private _gridCellSize: number;
    private _deltaHeight: number;

    private _lonlatArray: Array<[number, number]>;
    private _width: number;
    private _height: number;
    private _baseHeight: number;
    private _westNorthOfGrid: Cartesian3 | undefined;
    private _gridPositions: Array<Cartesian3>;

    private _totalVolume: number;
    private _cutVolume: number;
    private _fillVolume: number;

    private readonly _scene: Scene;

    private readonly _primitiveCollection: PrimitiveCollection;
    private readonly _labelCollection: LabelCollection;
    private _meshPrimitive: Primitive | undefined;

    private _canceled: boolean;
    private _clampedGridPositions: Cartesian3[] | undefined;

    constructor(options: GridMeshConstructorOptions) {
        this._polygonPositions = options.polygonPositions;
        this._gridCellSize = options.gridCellSize;
        this._deltaHeight = options.deltaHeight;

        this._scene = options.scene;
        this._width = 0;
        this._height = 0;

        this._gridPositions = [];
        this._lonlatArray = []; // in radians
        this._totalVolume = 0;
        this._cutVolume = 0;
        this._fillVolume = 0;
        this._primitiveCollection = options.primitiveCollection;
        this._labelCollection = this._primitiveCollection.add(new LabelCollection());
        this._meshPrimitive = undefined;

        this._canceled = false;

        this._baseHeight = 0;

        this._prepareLonlatArray();
        this._constructGrid();

        if (options.clampedGridPositions) {
            this._draw(options.clampedGridPositions);
        }
    }

    get polygonPositions() {
        return this._polygonPositions;
    }

    set polygonPositions(positions: Cartesian3[]) {
        this._polygonPositions.length = 0;

        positions.forEach((position) => {
            this._polygonPositions.push(position.clone(new Cartesian3()));
        });

        this._constructGrid();
    }

    get width() {
        return this._width;
    }

    get height() {
        return this._height;
    }

    get gridCellSize() {
        return this._gridCellSize;
    }

    set gridCellSize(val) {
        this._gridCellSize = val;

        this._constructGrid();
    }

    get deltaHeight() {
        return this._deltaHeight;
    }

    cancel() {
        this._canceled = true;
    }

    destroy() {
        const primitives = this._primitiveCollection;

        primitives.remove(this._labelCollection);

        if (this._meshPrimitive) {
            primitives.remove(this._meshPrimitive);
        }

        destroyObject(this);
    }

    extrude(height: number) {
        if (!this._westNorthOfGrid) {
            return;
        }

        if (!this._meshPrimitive) {
            return;
        }

        this._deltaHeight = height;

        const len = Cartesian3.magnitude(this._westNorthOfGrid);

        const extrudedNorthWestOfGrid = Cartesian3.multiplyByScalar(
            this._westNorthOfGrid,
            (len + height) / len,
            new Cartesian3()
        );

        this._meshPrimitive.modelMatrix = Transforms.eastNorthUpToFixedFrame(extrudedNorthWestOfGrid);

        this._scene.requestRender();
    }

    _prepareLonlatArray() {
        const polygonPositions = this._polygonPositions;
        this._lonlatArray.length = 0;

        for (let i = 0; i < polygonPositions.length; i++) {
            const cartographic = Cartographic.fromCartesian(polygonPositions[i]);

            this._lonlatArray.push([cartographic.longitude, cartographic.latitude]);
        }
    }

    _constructGrid() {
        const polygonPositions = this._polygonPositions;
        const gridCellSize = this._gridCellSize;

        let minLon = Number.MAX_VALUE;
        let maxLon = -Number.MAX_VALUE;
        let minLat = Number.MAX_VALUE;
        let maxLat = -Number.MAX_VALUE;

        let baseHeight = 0;

        for (let i = 0; i < polygonPositions.length; i++) {
            const cartographic = Cartographic.fromCartesian(polygonPositions[i]);

            if (cartographic.longitude > maxLon) maxLon = cartographic.longitude;
            if (cartographic.longitude < minLon) minLon = cartographic.longitude;
            if (cartographic.latitude > maxLat) maxLat = cartographic.latitude;
            if (cartographic.latitude < minLat) minLat = cartographic.latitude;

            baseHeight += cartographic.height;
        }

        baseHeight /= polygonPositions.length;

        const latStepSizeRadians = gridCellSize / CesiumMath.DEGREES_PER_RADIAN / 111111;
        const lonStepSizeRadians = gridCellSize / CesiumMath.DEGREES_PER_RADIAN / (111111 * Math.cos(maxLat));

        this._width = Math.ceil((maxLon - minLon) / lonStepSizeRadians);
        this._height = Math.ceil((maxLat - minLat) / latStepSizeRadians);

        this._gridPositions = new Array(this._width * this._height);

        const xStep = (maxLon - minLon) / (this._width - 1);
        const yStep = (maxLat - minLat) / (this._height - 1);

        for (let x = 0; x <= this._width - 1; x++) {
            const lon = minLon + xStep * x;

            for (let y = 0; y <= this._height - 1; y++) {
                const lat = minLat + yStep * y;

                // this._gridPositions[y * this._width + x] = Cartesian3.fromRadians(lon, lat, baseHeight);
                this._gridPositions[y * this._width + x] = Cartesian3.fromRadians(lon, lat, 0);
            }
        }

        this._baseHeight = baseHeight;
        this._westNorthOfGrid = Cartesian3.fromRadians(minLon, maxLat, baseHeight);
    }

    calculateVolume(objectsToExclude: any[], progressCallback: (a: number) => void) {
        const gridPositions: Cartographic[] = [];

        this._gridPositions.forEach((position) => {
            const carto = Cartographic.fromCartesian(position);
            carto.height = 0;

            gridPositions.push(carto);
        });

        this._scene.globe.depthTestAgainstTerrain = true;

        return new Promise((resolve, reject) => {
            this._totalVolume = 0;
            this._cutVolume = 0;
            this._fillVolume = 0;

            const fullResults: Array<Cartographic> = [];

            let partialVolumeCalc = null;

            const division = 10;
            const currentProgress = 0.1;
            const progressStep = (1 - currentProgress) / division;

            const itemsPerStep = Math.ceil(gridPositions.length / division);
            let progress = 0.1;

            for (let i = 0; i < gridPositions.length; i += itemsPerStep) {
                const progressStepsPoints = gridPositions.slice(i, i + itemsPerStep);

                if (!partialVolumeCalc) {
                    partialVolumeCalc = this._scene
                        .sampleHeightMostDetailed(progressStepsPoints, objectsToExclude, 0.1)
                        // eslint-disable-next-line no-loop-func
                        .then((result: Cartographic[]) => {
                            for (let j = 0; j < result.length; j++) {
                                if (result[j] === undefined) {
                                    console.error(result);
                                    reject(Error("get undefined by sampleHeightMostDetailed"));
                                    return;
                                }

                                if (!result[j].height) {
                                    console.error(result);
                                    reject(Error("get undefined height by sampleHeightMostDetailed"));
                                    return;
                                }

                                if (result[j].height < -11034 || result[j].height > 8848) {
                                    console.error(result);
                                    reject(Error("get invalid height by sampleHeightMostDetailed"));
                                    return;
                                }
                            }

                            fullResults.push(...result);

                            progress += progressStep;
                            progressCallback(progress);
                        });
                } else {
                    // eslint-disable-next-line no-loop-func, consistent-return
                    partialVolumeCalc = partialVolumeCalc.then(() => {
                        if (this._canceled) {
                            reject(Error("canceled"));
                        } else {
                            return this._scene
                                .sampleHeightMostDetailed(progressStepsPoints, objectsToExclude, 0.1)
                                .then((result: Cartographic[]) => {
                                    for (let j = 0; j < result.length; j++) {
                                        if (result[j] === undefined) {
                                            console.error(result);
                                            reject(Error("get undefined by sampleHeightMostDetailed"));
                                            return;
                                        }

                                        if (!result[j].height) {
                                            console.error(result);
                                            reject(Error("get undefined height by sampleHeightMostDetailed"));
                                            return;
                                        }

                                        if (result[j].height < -11034 || result[j].height > 8848) {
                                            console.error(result);
                                            reject(Error("get invalid height by sampleHeightMostDetailed"));
                                            return;
                                        }
                                    }

                                    fullResults.push(...result);

                                    progress += progressStep;
                                    progressCallback(progress);
                                });
                        }
                    });
                }
            }

            partialVolumeCalc!.then(() => {
                this._scene.globe.depthTestAgainstTerrain = false;
                if (this._canceled) {
                    reject(Error("canceled"));
                } else {
                    for (let i = 0; i < fullResults.length; i++) {
                        if (fullResults[i] === undefined) {
                            reject(new Error("failed to get data"));
                            return;
                        }
                    }

                    const fullResultCartesian: Cartesian3[] = [];

                    fullResults.forEach((carto) => {
                        fullResultCartesian.push(Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height));
                    });

                    this._clampedGridPositions = fullResultCartesian;

                    if (!this._draw(fullResultCartesian)) {
                        reject(new Error("failed to draw mesh!"));
                        return;
                    }

                    const result = {
                        total: this._totalVolume,
                        cut: this._cutVolume,
                        fill: this._fillVolume
                    };

                    resolve(result);
                }
            });
        });
    }

    clear() {
        this._labelCollection.removeAll();

        if (this._meshPrimitive) {
            this._primitiveCollection.remove(this._meshPrimitive);
            this._meshPrimitive = undefined;
        }

        this._clampedGridPositions = undefined;
    }

    _prepareMeshDataAndCalcVolumes(clampedGridPositions: Array<Cartesian3>) {
        const sampling = this._gridCellSize;

        const gridVerticesContainer = new GridVerticesContainer();

        let maxHeight = Number.NEGATIVE_INFINITY;
        const width = this._width;

        for (let x = 0; x <= width - 2; x += 1) {
            for (let y = 0; y < this._height - 1; y += 1) {
                const gridPositions = [];

                gridPositions.push(Cartesian3.clone(clampedGridPositions[y * width + x]));
                gridPositions.push(Cartesian3.clone(clampedGridPositions[y * width + (x + 1)]));
                gridPositions.push(Cartesian3.clone(clampedGridPositions[(y + 1) * width + (x + 1)]));
                gridPositions.push(Cartesian3.clone(clampedGridPositions[(y + 1) * width + x]));

                let totalHeight = 0;
                let contributors = 0;

                for (let i = 0; i < gridPositions.length; i++) {
                    if (!gridPositions[i]) {
                        console.error("invaid grid positon");
                    }

                    const cartographic = Cartographic.fromCartesian(gridPositions[i]);

                    if (pointInPolygon([cartographic.longitude, cartographic.latitude], this._lonlatArray)) {
                        if (cartographic.height > maxHeight) {
                            maxHeight = cartographic.height;
                        }

                        totalHeight += cartographic.height;
                        contributors++;
                    }
                }

                if (contributors === 4) {
                    const heightDif = totalHeight / 4 - this._baseHeight;

                    if (heightDif >= 0) {
                        this._cutVolume += sampling * sampling * heightDif;
                    } else {
                        this._fillVolume += sampling * sampling * -heightDif;
                    }

                    this._totalVolume += sampling * sampling * Math.abs(heightDif);
                }
            }
        }

        // prepare vertices
        const transform = Transforms.eastNorthUpToFixedFrame(this._westNorthOfGrid!);
        const invTransform = Matrix4.inverseTransformation(transform, new Matrix4());

        for (let x = 0; x <= width - 2; x += 1) {
            for (let y = 0; y < this._height - 1; y += 1) {
                const gridPositions = [];

                gridPositions.push(Cartesian3.clone(clampedGridPositions[y * width + x]));
                gridPositions.push(Cartesian3.clone(clampedGridPositions[y * width + (x + 1)]));
                gridPositions.push(Cartesian3.clone(clampedGridPositions[(y + 1) * width + (x + 1)]));
                gridPositions.push(Cartesian3.clone(clampedGridPositions[(y + 1) * width + x]));

                let totalHeight = 0;
                let contributors = 0;

                for (let i = 0; i < gridPositions.length; i++) {
                    const cartographic = Cartographic.fromCartesian(gridPositions[i]);

                    if (pointInPolygon([cartographic.longitude, cartographic.latitude], this._lonlatArray)) {
                        totalHeight += cartographic.height;
                        contributors++;
                    }
                }

                if (contributors !== 4) {
                    continue;
                }

                const cellHeight = totalHeight / 4;

                const maxHeightDif = maxHeight - this._baseHeight;
                const heightDif = cellHeight - this._baseHeight;

                let ratio = heightDif / maxHeightDif;
                ratio = CesiumMath.clamp(ratio, 0, 1);

                const color = Color.lerp(Color.BLUE.withAlpha(0.5), Color.RED.withAlpha(0.5), ratio, new Color());

                // save as local positions
                gridVerticesContainer.addNewVertex(
                    y * width + x,
                    Matrix4.multiplyByPoint(invTransform, clampedGridPositions[y * width + x], new Cartesian3()),
                    color
                );

                gridVerticesContainer.addNewVertex(
                    y * width + (x + 1),
                    Matrix4.multiplyByPoint(invTransform, clampedGridPositions[y * width + (x + 1)], new Cartesian3()),
                    color
                );

                gridVerticesContainer.addNewVertex(
                    (y + 1) * width + (x + 1),
                    Matrix4.multiplyByPoint(
                        invTransform,
                        clampedGridPositions[(y + 1) * width + (x + 1)],
                        new Cartesian3()
                    ),
                    color
                );

                gridVerticesContainer.addNewVertex(
                    (y + 1) * width + x,
                    Matrix4.multiplyByPoint(invTransform, clampedGridPositions[(y + 1) * width + x], new Cartesian3()),
                    color
                );
            }
        }

        // prepare mesh indices
        const indices = [];

        for (let x = 0; x <= width - 2; x += 1) {
            for (let y = 0; y < this._height - 1; y += 1) {
                const gridPositions = [];

                gridPositions.push(Cartesian3.clone(clampedGridPositions[y * width + x]));
                gridPositions.push(Cartesian3.clone(clampedGridPositions[y * width + (x + 1)]));
                gridPositions.push(Cartesian3.clone(clampedGridPositions[(y + 1) * width + (x + 1)]));
                gridPositions.push(Cartesian3.clone(clampedGridPositions[(y + 1) * width + x]));

                let contributors = 0;

                for (let i = 0; i < gridPositions.length; i++) {
                    const cartographic = Cartographic.fromCartesian(gridPositions[i]);

                    if (pointInPolygon([cartographic.longitude, cartographic.latitude], this._lonlatArray)) {
                        contributors++;
                    }
                }

                if (contributors === 4) {
                    // first triangle
                    indices.push(gridVerticesContainer.getVertexLocalIndex(y * width + x));
                    indices.push(gridVerticesContainer.getVertexLocalIndex(y * width + (x + 1)));
                    indices.push(gridVerticesContainer.getVertexLocalIndex((y + 1) * width + x));

                    // second triangle
                    indices.push(gridVerticesContainer.getVertexLocalIndex(y * width + (x + 1)));
                    indices.push(gridVerticesContainer.getVertexLocalIndex((y + 1) * width + (x + 1)));
                    indices.push(gridVerticesContainer.getVertexLocalIndex((y + 1) * width + x));
                }
            }
        }

        return {
            vertices: gridVerticesContainer.positions,
            indices: indices,
            colors: gridVerticesContainer.colors,
            maxHeight: maxHeight
        };
    }

    _draw(gridCellsTopPositions: Array<Cartesian3>) {
        const data = this._prepareMeshDataAndCalcVolumes(gridCellsTopPositions);

        if (data.vertices.length === 0 || data.indices.length === 0 || data.colors.length === 0) {
            return false;
        }

        this._meshPrimitive = createMeshPrimitive(
            Transforms.eastNorthUpToFixedFrame(this._westNorthOfGrid!),
            data.vertices,
            data.indices as Array<number>,
            data.colors,
            false
        );

        this._primitiveCollection.add(this._meshPrimitive);

        this._drawVolumeLabel(data.maxHeight + 1);

        return true;
    }

    _drawVolumeLabel(height: number) {
        const lonlatsInDegree: Array<[number, number]> = [];

        this._lonlatArray.forEach((lonLat) => {
            lonlatsInDegree.push([CesiumMath.toDegrees(lonLat[0]), CesiumMath.toDegrees(lonLat[1])]);
        });

        lonlatsInDegree.push(lonlatsInDegree[0]);

        const turfPolygon = turf.polygon([lonlatsInDegree], { name: "" });
        const centroid = turf.centroid(turfPolygon);

        const coordinates = centroid.geometry.coordinates;

        const longitude = coordinates[0];
        const latitude = coordinates[1];

        this._labelCollection.add({
            position: Cartesian3.fromDegrees(longitude, latitude, height),
            text: `${this._totalVolume.toFixed(2)}㎥`,
            font: "11pt Lucida Console",
            horizontalOrigin: HorizontalOrigin.LEFT,
            verticalOrigin: VerticalOrigin.CENTER,
            style: LabelStyle.FILL_AND_OUTLINE,
            outlineColor: Color.BLACK,
            outlineWidth: 2,
            pixelOffset: new Cartesian2(6, -4)
        });
    }

    get show() {
        if (this._meshPrimitive) {
            return this._meshPrimitive.show;
        }

        return false;
    }

    set show(val: boolean) {
        if (!this._meshPrimitive) {
            return;
        }

        this._meshPrimitive.show = val;

        for (let i = 0; i < this._labelCollection.length; i++) {
            this._labelCollection.get(i).show = val;
        }
    }

    get clampedGirdPositions() {
        return this._clampedGridPositions;
    }

    resetCancel() {
        this._canceled = false;
    }
}

export { GridMesh };
