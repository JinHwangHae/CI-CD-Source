import {
    Cartesian3,
    LabelCollection,
    PointPrimitive,
    PointPrimitiveCollection,
    PrimitiveCollection,
    Scene,
    Viewer
} from "cesium";

import { getWorldPosition, MeasureUnits, MouseEvent, PrimitiveSettings } from "../../../core";

import { BaseDrawingTool } from "../BaseDrawingTool";

import { PointMeasurement } from "./PointMeasurement";
import { DistanceMeasurement } from "./DistanceMeasurement";
import { PolylineMeasurement } from "./PolylineMeasurement";
import { AreaMeasurement } from "./AreaMeasurement";
import { VolumeMeasurement } from "./VolumeMeasurement";

export interface PositionData {
    x: number;
    y: number;
    z: number;
}

export interface PointMeasurementData {
    position: { x: number; y: number; z: number };
    height: number;
    slope: number;
}

export interface DistanceMeasurementData {
    startPointPosition: { x: number; y: number; z: number };
    endPointPosition: { x: number; y: number; z: number };
}

export declare type VolumeMeasurementData = {
    polygonPositions: number[];
    gridCellSize: number;
    height: number;
    clampedGridPositions: number[] | undefined;
    clampToGround: boolean;
};

declare type Measurement =
    | PointMeasurement
    | DistanceMeasurement
    | PolylineMeasurement
    | AreaMeasurement
    | VolumeMeasurement;

export declare type MeasurementToolConstructorOptions = {
    viewer: Viewer;
    name: string;
    primitives: PrimitiveCollection;
    units: MeasureUnits;
    locale?: Intl.LocalesArgument;
    points: PointPrimitiveCollection;
    labels: LabelCollection;
};

const scratchCartesian3 = new Cartesian3();

export abstract class MeasurementTool extends BaseDrawingTool {
    protected readonly _scene: Scene;

    protected readonly _labelCollection: LabelCollection;
    protected readonly _pointCollection: PointPrimitiveCollection;
    protected readonly _primitives: PrimitiveCollection;
    protected readonly _selectedUnits: MeasureUnits;
    protected readonly _selectedLocale?: Intl.LocalesArgument;

    protected _point: PointPrimitive;
    protected _measurements: Measurement[] = [];

    constructor(options: MeasurementToolConstructorOptions) {
        super(options);

        this._labelCollection = options.labels;
        this._pointCollection = options.points;
        this._primitives = options.primitives;
        this._selectedUnits = options.units;
        this._selectedLocale = options.locale;
        this._scene = this._viewer.scene;

        this._point = this._pointCollection.add(PrimitiveSettings.getPointOptions());
    }

    get measurements() {
        return this._measurements;
    }

    get selectedUnits() {
        return this._selectedUnits;
    }

    get selectedLocale() {
        return this._selectedLocale;
    }

    canvasMoveEvent(event: MouseEvent): void {
        const position = getWorldPosition(this._scene, event.pos, scratchCartesian3);

        if (!position) {
            this._point.show = false;
            return;
        }

        this._point.position = position;
        this._point.show = true;
    }

    /**
     * Resets the widget.
     */
    abstract reset(): void;

    abstract removeMeasurementById(id: string): boolean;

    // eslint-disable-next-line class-methods-use-this
    isDestroyed() {
        return false;
    }

    abstract destroy(): void;

    abstract loadData(
        data: PointMeasurementData | DistanceMeasurementData | PositionData[] | VolumeMeasurementData,
        id: string
    ): void;

    showHideAllMeasurements(show: boolean) {
        this._measurements.forEach((measurement) => {
            measurement.showHide(show);
        });
    }
}
