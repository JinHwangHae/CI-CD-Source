import {
    BillboardCollection,
    Cartesian2,
    Cartesian3,
    Color,
    destroyObject,
    LabelCollection,
    PointPrimitive,
    PointPrimitiveCollection,
    PrimitiveCollection,
    Scene
} from "cesium";

import { GridPolygonPrimitive, PointOptions, PolylinePrimitive } from "../../../core";
import { GridMesh } from "./GridMesh";
import { Measurement } from "./Measurement";
import { MeasurementType } from "./MeasurementType";
import { VolumeMeasurementData } from "./MeasurementTool";
import { EditablePolygon } from "../EditablePolygon";

interface ConstructorOptions {
    id: string;
    scene: Scene;
    billboardCollection: BillboardCollection;
    pointPrimitiveCollection: PointPrimitiveCollection;
    pointOptions: PointOptions;
    polygonPositions: Array<Cartesian3>;
    deltaHeight: number;
    gridCellSize: number;
    primitiveCollection: PrimitiveCollection;
    clampedGridPositions?: Cartesian3[] | undefined;
    clampToGround: boolean;
}

export class VolumeMeasurement extends Measurement {
    private readonly _primitiveCollection: PrimitiveCollection;
    private _polylinePrimitive: PolylinePrimitive;
    private _gridPolygonPrimitive: GridPolygonPrimitive;
    private readonly _labelCollection: LabelCollection;
    private readonly _gridMesh: GridMesh;
    private readonly _editablePolygon: EditablePolygon;
    private readonly _pointPrimitiveCollection: PointPrimitiveCollection;
    private _clampToGround: boolean;

    constructor(options: ConstructorOptions) {
        super({
            id: options.id,
            type: MeasurementType.Volume
        });

        this._primitiveCollection = options.primitiveCollection;
        this._labelCollection = this._primitiveCollection.add(new LabelCollection());

        this._clampToGround = options.clampToGround;

        this._polylinePrimitive = new PolylinePrimitive({
            color: Color.RED,
            loop: true,
            positions: options.polygonPositions,
            depthTest: false,
            clampToGround: this._clampToGround,
            allowPicking: false
        });

        this._primitiveCollection.add(this._polylinePrimitive);

        this._gridMesh = new GridMesh({
            scene: options.scene,
            polygonPositions: options.polygonPositions,
            gridCellSize: options.gridCellSize,
            deltaHeight: options.deltaHeight,
            primitiveCollection: options.primitiveCollection,
            clampedGridPositions: options.clampedGridPositions
        });

        // we should not use options.polygonPositions for creating GridPolygonPrimitive
        // because options.polygonPositions will be modified (height information is removed) after passing

        const positions: Cartesian3[] = [];

        options.polygonPositions.forEach((position: Cartesian3) => {
            positions.push(Cartesian3.clone(position, new Cartesian3()));
        });

        this._gridPolygonPrimitive = new GridPolygonPrimitive({
            positions: positions,
            color: Color.YELLOW,
            lineCount: new Cartesian2(this.gridMesh.width, this._gridMesh.height),
            cellAlpha: 0.1,
            depthTest: true,
            clampToGround: this._clampToGround,
            allowPicking: true
        });

        this._primitiveCollection.add(this._gridPolygonPrimitive);

        const points: PointPrimitive[] = [];

        this._pointPrimitiveCollection = options.pointPrimitiveCollection;

        options.polygonPositions.forEach((position: Cartesian3) => {
            const point = this._pointPrimitiveCollection.add({
                ...options.pointOptions,
                position: Cartesian3.clone(position, new Cartesian3())
            });

            points.push(point);
        });

        this._editablePolygon = new EditablePolygon({
            billboardCollection: options.billboardCollection,
            pointPrimitiveCollection: options.pointPrimitiveCollection,
            pointOptions: options.pointOptions,
            points: points,
            polyline: this._polylinePrimitive,
            polygon: this._gridPolygonPrimitive
        });

        this._editablePolygon.vertexChanged.addEventListener(this._onVertexChanged.bind(this));
    }

    get polylinePrimitive() {
        return this._polylinePrimitive;
    }

    get gridCellSize() {
        return this._gridMesh.gridCellSize;
    }

    set gridCellSize(val: number) {
        this._gridMesh.gridCellSize = val;

        this._gridPolygonPrimitive.lineCount = new Cartesian2(this.gridMesh.width, this._gridMesh.height);
    }

    get gridMesh() {
        return this._gridMesh;
    }

    get clampToGround() {
        return this._clampToGround;
    }

    set clampToGround(val: boolean) {
        this._clampToGround = val;

        this._polylinePrimitive.clampToGround = val;
        this._gridPolygonPrimitive.clampToGround = val;
    }

    /**
     * Recalculates the area with the provided sampling step size and displays a volume object.
     *
     * @param {Double} gridCellSize the size in meters square between each height sample
     * @param {Function} progressCallback a function that will be called with the progress as a value between 0 and 1
     * @returns
     */
    calculate(progressCallback: (progress: number) => void): Promise<{ total: number; cut: number; fill: number }> {
        this._gridMesh.clear();

        progressCallback(0.0);

        const promise = new Promise((resolve, reject) => {
            progressCallback(0.1);

            const calculateVoumePromise = this._gridMesh.calculateVolume(
                [this._polylinePrimitive.primitive, this._gridPolygonPrimitive.primitive],
                progressCallback
            );

            calculateVoumePromise
                .then(
                    (result) => {
                        progressCallback(1.0);

                        resolve(result);
                    },
                    (e: Error) => {
                        this._gridMesh.resetCancel();
                        reject(e);
                    }
                )
                .catch((e) => {
                    reject(e);
                });
        });

        // @ts-ignore
        return promise;
    }

    showHide(show: boolean) {
        this._polylinePrimitive.show = show;
        this._gridPolygonPrimitive.show = show;
        this._pointPrimitiveCollection.show = show;
        this._editablePolygon.showHideMiddleVertice(show);
        this._gridMesh.show = show;
    }

    getDetail(): VolumeMeasurementData {
        let clampedGridPositions;

        if (this._gridMesh.clampedGirdPositions) {
            clampedGridPositions = Cartesian3.packArray(this._gridMesh.clampedGirdPositions);
        }

        return {
            gridCellSize: this._gridMesh.gridCellSize,
            height: this._gridMesh.deltaHeight,
            polygonPositions: Cartesian3.packArray(this._gridMesh.polygonPositions),
            clampedGridPositions: clampedGridPositions,
            clampToGround: this.clampToGround
        };
    }

    destroy() {
        const primitives = this._primitiveCollection;

        primitives.remove(this._labelCollection);
        primitives.remove(this._polylinePrimitive);
        primitives.remove(this._gridPolygonPrimitive);

        this._editablePolygon.pointPrimitives.forEach((point: PointPrimitive) => {
            this._pointPrimitiveCollection.remove(point);
        });

        this._gridMesh.clear();

        destroyObject(this);
    }

    isContain(primitive: any): boolean {
        if (Object.is(primitive, this._polylinePrimitive.primitive)) {
            return true;
        }

        if (Object.is(primitive, this._gridPolygonPrimitive.primitive)) {
            return true;
        }

        return false;
    }

    get editablePolygon() {
        return this._editablePolygon;
    }

    _onVertexChanged() {
        this._gridMesh.polygonPositions = this._gridPolygonPrimitive.positions;

        this._gridPolygonPrimitive.lineCount = new Cartesian2(this.gridMesh.width, this._gridMesh.height);
    }
}
