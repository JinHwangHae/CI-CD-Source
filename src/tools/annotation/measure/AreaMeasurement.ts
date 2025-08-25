import { Cartesian3, Label } from "cesium";
import { calculateAreaOfPolygon, MeasureUnits } from "../../../core";

import { EditablePolygon } from "../EditablePolygon";
import { MeasurementTool } from "./MeasurementTool";
import { MeasurementType } from "./MeasurementType";
import { Measurement } from "./Measurement";
import { calculateMostTopPosition } from "./common";

interface ConstructorOptions {
    id: string;

    label: Label;
    polygon: EditablePolygon;
    measurementTool: MeasurementTool;
}

export class AreaMeasurement extends Measurement {
    private readonly _parentTool: MeasurementTool;

    private readonly _label: Label;
    private readonly _polygon: EditablePolygon;

    constructor(options: ConstructorOptions) {
        super({
            id: options.id,
            type: MeasurementType.Area
        });

        this._label = options.label;
        this._polygon = options.polygon;
        this._parentTool = options.measurementTool;

        this._polygon.vertexChanged.addEventListener(this._onVertexChanged.bind(this));
    }

    get labelPrimitive() {
        return this._label;
    }

    get pointPrimitives() {
        return this._polygon.pointPrimitives;
    }

    get polylinePrimitive() {
        return this._polygon.polylinePrimitive;
    }

    get polygonPrimitive() {
        return this._polygon.polygonPrimitive;
    }

    get polygon() {
        return this._polygon;
    }

    private _onVertexChanged() {
        const positions = this._polygon.polygonPrimitive.positions;
        const area = calculateAreaOfPolygon(positions);
        this._label.text = MeasureUnits.areaToString(
            area,
            this._parentTool.selectedUnits.areaUnits,
            this._parentTool.selectedLocale,
            3
        );

        this._label.position = calculateMostTopPosition(this._parentTool.scene, positions, new Cartesian3());
        this.updated.raiseEvent();
    }

    showHide(show: boolean) {
        for (let i = 0; i < this.pointPrimitives.length; i++) this.pointPrimitives[i].show = show;

        this._label.show = show;
        this.polylinePrimitive.show = show;
        this.polygonPrimitive.show = show;
    }

    getDetail(): Object {
        return this.polygonPrimitive.positions;
    }

    isContain(primitive: any): boolean {
        if (Object.is(primitive, this._label)) {
            return true;
        }

        return this._polygon.isContained(primitive);
    }

    measurementString(): string {
        const positions = this._polygon.polygonPrimitive.positions;
        const area = calculateAreaOfPolygon(positions);
        const ret = `Area: ${MeasureUnits.areaToString(
            area,
            this._parentTool.selectedUnits.areaUnits,
            this._parentTool.selectedLocale,
            3
        )}`;

        return ret;
    }
}
