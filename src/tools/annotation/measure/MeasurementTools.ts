import { LabelCollection, PointPrimitiveCollection, PrimitiveCollection, Viewer } from "cesium";

import { CanvasEventHandlerParent, CRSInfo, CRSManager, MapTools, MeasureUnits } from "../../../core";

import { MeasurementTool } from "./MeasurementTool";
import { PointMeasurementTool } from "./PointMeasurementTool";
import { DistanceMeasurementTool } from "./DistanceMeasurementTool";
import { PolylineMeasurementTool } from "./PolylineMeasurementTool";
import { AreaMeasurementTool } from "./AreaMeasurementTool";
import { VolumeMeasurementTool } from "./VolumeMeasurementTool";

interface ConstructorOptions {
    parent: CanvasEventHandlerParent;
    viewer: Viewer;
    units: MeasureUnits;
    crsInfo: CRSInfo;
    crsManager: CRSManager;
}

export class MeasurementTools extends MapTools {
    private readonly _units;

    constructor(options: ConstructorOptions) {
        super(options);

        const scene = options.viewer.scene;

        const units = options.units;

        this._units = options.units;

        const primitiveCollection = new PrimitiveCollection();

        // @ts-ignore
        primitiveCollection.id = "MeasurementTools-PrimitiveCollection";

        const primitives = scene.primitives.add(primitiveCollection);
        const points = primitives.add(new PointPrimitiveCollection());
        const labels = primitives.add(new LabelCollection());

        this.addTool(
            new PointMeasurementTool({
                name: "PointMeasurementTool",
                viewer: options.viewer,
                primitives: primitives,
                units: units,
                points: points,
                labels: labels,
                crsInfo: options.crsInfo,
                crsManager: options.crsManager
            })
        );

        this.addTool(
            new DistanceMeasurementTool({
                name: "DistanceMeasurementTool",
                viewer: options.viewer,
                primitives: primitives,
                units: units,
                points: points,
                labels: labels
            })
        );

        this.addTool(
            new PolylineMeasurementTool({
                name: "PolylineMeasurementTool",
                viewer: options.viewer,
                primitives: primitives,
                units: units,
                points: points,
                labels: labels
            })
        );

        this.addTool(
            new AreaMeasurementTool({
                name: "AreaMeasurementTool",
                viewer: options.viewer,
                primitives: primitives,
                units: units,
                points: points,
                labels: labels
            })
        );

        this.addTool(
            new VolumeMeasurementTool({
                name: "VolumeMeasurementTool",
                viewer: options.viewer,
                primitives: primitives,
                units: units,
                points: points,
                labels: labels
            })
        );
    }

    get units() {
        return this._units;
    }

    get pointMeasurmentTool() {
        return this.tools[0] as PointMeasurementTool;
    }

    get distanceMeasurmentTool() {
        return this.tools[1] as DistanceMeasurementTool;
    }

    get polylineMeasurmentTool() {
        return this.tools[2] as PolylineMeasurementTool;
    }

    get areaMeasurmentTool() {
        return this.tools[3] as AreaMeasurementTool;
    }

    get volumeMeasurementTool() {
        return this.tools[4] as VolumeMeasurementTool;
    }

    getMeasurmentById(id: string) {
        for (let i = 0; i < this.tools.length; i++) {
            const measurementTool = this.tools[i] as MeasurementTool;

            for (let j = 0; j < measurementTool.measurements.length; j++) {
                if (measurementTool.measurements[j].id === id) {
                    return measurementTool.measurements[j];
                }
            }
        }

        return undefined;
    }

    showHideMeasurementById(id: string, show: boolean) {
        const measurement = this.getMeasurmentById(id);

        if (!measurement) {
            console.warn(`failed to find measurement id: ${id}`);
            return;
        }

        measurement.showHide(show);
    }

    showHideAllMeasurements(show: boolean) {
        this.tools.forEach((tool) => {
            const measurementTool = tool as MeasurementTool;

            measurementTool.showHideAllMeasurements(show);
        });
    }

    removeMeasurementById(id: string) {
        let removed = false;

        this.tools.forEach((tool) => {
            const measurementTool = tool as MeasurementTool;

            removed = measurementTool.removeMeasurementById(id);
        });

        return removed;
    }

    getMeasurmentByPrimitive(primitive: any) {
        for (let i = 0; i < this.tools.length; i++) {
            const measurementTool = this.tools[i] as MeasurementTool;

            for (let j = 0; j < measurementTool.measurements.length; j++) {
                if (measurementTool.measurements[j].isContain(primitive)) {
                    return measurementTool.measurements[j];
                }
            }
        }

        return undefined;
    }
}
