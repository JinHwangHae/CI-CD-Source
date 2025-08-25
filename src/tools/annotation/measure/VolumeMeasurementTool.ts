/* qeslint-disable */
// q@ts-nocheck

import {
    BillboardCollection,
    Cartesian2,
    Cartesian3,
    Cesium3DTileset,
    Color,
    createGuid,
    defined,
    destroyObject,
    Event,
    PrimitiveCollection
} from "cesium";
import { calculateAreaOfPolygon, MouseButton, MouseEvent, PolylineDrawing } from "../../../core";

import { MeasurementTool, MeasurementToolConstructorOptions, VolumeMeasurementData } from "./MeasurementTool";

import { GridMesh } from "./GridMesh";
import { VolumeMeasurement } from "./VolumeMeasurement";

export class VolumeMeasurementTool extends MeasurementTool {
    private _gridCellSize: number = 0.1;

    private _running: boolean;

    private _currentMeasurement: VolumeMeasurement | undefined;
    private readonly _calculationProgress: Event = new Event();

    private _calculationTimeFactor: number;

    private readonly _polylineDrawing: PolylineDrawing;
    private readonly _primitiveCollection: PrimitiveCollection;
    private readonly _billboardCollection: BillboardCollection;
    private _firstClickedTileset: Cesium3DTileset | undefined;

    constructor(options: MeasurementToolConstructorOptions) {
        super(options);

        this._running = false;
        this._currentMeasurement = undefined;
        this._calculationTimeFactor = 100;

        const primitiveCollection = options.primitives;
        this._primitiveCollection = primitiveCollection;

        this._polylineDrawing = new PolylineDrawing({
            scene: this.scene,
            primitives: primitiveCollection,
            pointOptions: {
                pixelSize: 10,
                color: Color.YELLOW,
                disableDepthTestDistance: Number.POSITIVE_INFINITY
            },
            polylineOptions: {
                color: Color.YELLOW,
                loop: true
            }
        });

        this._billboardCollection = new BillboardCollection();
        this.scene.primitives.add(this._billboardCollection);
    }

    activate(options: any) {
        super.activate(options);

        this._polylineDrawing.reset();
    }

    deactivate(deactivateOptions: any) {
        super.deactivate(deactivateOptions);

        this._polylineDrawing.reset();
    }

    get gridCellSize() {
        return this._gridCellSize;
    }

    set gridCellSize(val: number) {
        this._gridCellSize = val;

        if (this._currentMeasurement) {
            this._currentMeasurement.gridCellSize = this.gridCellSize;
        }
    }

    get gridMeshs() {
        return this._measurements;
    }

    get currentMeasurement() {
        return this._currentMeasurement as VolumeMeasurement;
    }

    get currentGridMesh() {
        return this._currentMeasurement?.gridMesh;
    }

    get drawingFinished() {
        return this._drawingFinished;
    }

    get calculationProgress() {
        return this._calculationProgress;
    }

    get running() {
        return this._running;
    }

    get drawingStarted() {
        return this._drawingStarted;
    }

    canvasPressEvent(event: MouseEvent): void {
        if (this._running) return;

        if (event.button === MouseButton.LeftButton) {
            if (this._clickedPointOfDrawnPolyline(event)) {
                // this is double click
                return;
            }

            const tileset = this._getTileset(event.pos);

            if (!tileset) {
                setTimeout(() => {
                    alert("Please click a tileset");
                }, 100);

                return;
            }

            if (this._polylineDrawing.positions.length === 0) {
                this._firstClickedTileset = tileset;
            } else if (!Object.is(this._firstClickedTileset, tileset)) {
                setTimeout(() => {
                    alert("Please click same tileset");
                }, 100);

                return;
            }

            this._polylineDrawing.handleClick(event.pos);

            if (this._polylineDrawing.positions.length === 3) {
                this._drawingStarted.raiseEvent();
            }
        } else if (event.button === MouseButton.RightButton) {
            this.finishDrawing();
        }
    }

    canvasMoveEvent(event: MouseEvent): void {
        this._polylineDrawing.handleMouseMove(event.pos);
    }

    canvasDoubleClickEvent(): void {
        this.finishDrawing();
    }

    finishDrawing() {
        if (this._polylineDrawing.positions.length < 3) {
            alert("Can not terminate!");
            return;
        }

        this._polylineDrawing.handleDoubleClick();

        const drawing = this._polylineDrawing;

        this._currentMeasurement = new VolumeMeasurement({
            id: createGuid(),
            scene: this.scene,
            billboardCollection: this._billboardCollection,
            pointPrimitiveCollection: this._pointCollection,
            pointOptions: drawing.pointOptions,
            polygonPositions: drawing.positions,
            gridCellSize: this._gridCellSize,
            deltaHeight: 0,
            primitiveCollection: this._primitiveCollection,
            clampToGround: true
        });

        this._measurements.push(this._currentMeasurement);

        // @ts-ignore
        this._drawingFinished.raiseEvent(this._measurements.length - 1);
    }

    calculate() {
        this._running = true;

        const promise = this._currentMeasurement!.calculate((progress: number) => {
            // @ts-ignore
            this._calculationProgress.raiseEvent(progress);
        });

        promise
            .then(
                () => {
                    this._running = false;
                },
                () => {
                    this._running = false;
                }
            )
            .catch(() => {
                this._running = false;
            });

        return promise;
    }

    guessCalculationTime() {
        // https://github.com/Construkted-Reality/construkted_reality_v1.x/issues/657

        const volumeMeasurement = this._currentMeasurement!;

        const c = this._calculationTimeFactor;
        const area = calculateAreaOfPolygon(volumeMeasurement.gridMesh.polygonPositions);
        const gridCellSize = volumeMeasurement.gridCellSize;

        return area / c / (gridCellSize * gridCellSize);
    }

    _updateCalculationTimeFactor(elapsedTime: number, gridMesh: GridMesh, gridCellSize: number) {
        const area = Math.abs(calculateAreaOfPolygon(gridMesh.polygonPositions));

        this._calculationTimeFactor = area / (gridCellSize * gridCellSize) / elapsedTime;
    }

    loadData(data: VolumeMeasurementData, id: string) {
        const polygonPositions = Cartesian3.unpackArray(data.polygonPositions);
        const drawing = this._polylineDrawing;

        let clampedGridPositions;

        if (data.clampedGridPositions) {
            clampedGridPositions = Cartesian3.unpackArray(data.clampedGridPositions);
        }

        const measurement = new VolumeMeasurement({
            id: id,
            scene: this.scene,
            billboardCollection: this._billboardCollection,
            pointPrimitiveCollection: this._pointCollection,
            pointOptions: drawing.pointOptions,
            polygonPositions: polygonPositions,
            gridCellSize: data.gridCellSize,
            deltaHeight: data.height,
            primitiveCollection: this._primitiveCollection,
            clampedGridPositions: clampedGridPositions,
            clampToGround: data.clampToGround
        });

        this._measurements.push(measurement);

        this._currentMeasurement = measurement;
    }

    removeMeasurementById(id: string) {
        for (let i = 0; i < this._measurements.length; i++) {
            if (this._measurements[i].id === id) {
                if (this._currentMeasurement && this._currentMeasurement.id === id) {
                    this._currentMeasurement = undefined;
                }
                const volumeMeasurement = this._measurements[i] as VolumeMeasurement;

                volumeMeasurement.destroy();

                this._measurements.splice(i);
                return true;
            }
        }

        return false;
    }

    showHideMeasurementById(id: string, show: boolean) {
        const measurements = this._measurements.filter((measurement) => measurement.id === id);

        if (measurements.length > 0) {
            measurements[0].showHide(show);
        }
    }

    _clickedPointOfDrawnPolyline(event: MouseEvent) {
        const screenPosition = event.pos;
        const scene = this.scene;

        if (scene.pickPositionSupported) {
            // Don't pick default 3x3, or scene.pick may allow a mousePosition that isn't on the tileset to pickPosition.
            const pickedObject = scene.pick(screenPosition, 1, 1);

            if (!pickedObject) {
                return false;
            }

            if (!pickedObject.primitive) {
                return false;
            }

            const points = this._polylineDrawing.points;

            for (let i = 0; i < points.length; i++) {
                if (Object.is(points[i], pickedObject.primitive)) {
                    return true;
                }
            }

            return false;
        }

        return false;
    }

    _getTileset(screenPosition: Cartesian2) {
        const scene = this.scene;

        if (scene.pickPositionSupported) {
            // Don't pick default 3x3, or scene.pick may allow a mousePosition that isn't on the tileset to pickPosition.
            const pickedObject = scene.pick(screenPosition, 1, 1);

            if (defined(pickedObject) && pickedObject.primitive instanceof Cesium3DTileset) {
                return pickedObject.primitive;
            }
        }

        return undefined;
    }

    // eslint-disable-next-line class-methods-use-this
    isDestroyed() {
        return false;
    }

    /**
     * Destroys the measurement.
     */
    destroy() {
        return destroyObject(this);
    }

    // eslint-disable-next-line class-methods-use-this
    reset() {}
}
