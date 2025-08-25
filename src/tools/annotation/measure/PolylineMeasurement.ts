import { Cartesian2, Cartesian3, HorizontalOrigin, Label, LabelCollection, VerticalOrigin } from "cesium";

import { MeasureUnits, PrimitiveSettings } from "../../../core";

import { MeasurementType } from "./MeasurementType";
import { Measurement } from "./Measurement";
import { EditablePolyline } from "../EditablePolyline";
import { MeasurementTool } from "./MeasurementTool";

import { calculateMostTopPosition } from "./common";

interface ConstructorOptions {
    id: string;
    label: Label;
    labelCollection: LabelCollection;
    segmentLabels: Label[];
    polyline: EditablePolyline;
    measurementTool: MeasurementTool;
}

const fractions = 3;

export class PolylineMeasurement extends Measurement {
    private readonly _label: Label;
    private readonly _labelCollection: LabelCollection;
    private readonly _segmentLabels: Label[];
    private readonly _polyline: EditablePolyline;
    private readonly _parentTool: MeasurementTool;

    constructor(options: ConstructorOptions) {
        super({
            id: options.id,
            type: MeasurementType.Polyline
        });

        this._label = options.label;
        this._labelCollection = options.labelCollection;
        this._segmentLabels = options.segmentLabels;
        this._polyline = options.polyline;

        this._parentTool = options.measurementTool;

        this._polyline.vertexChanged.addEventListener(this._onVertexChanged.bind(this));
    }

    get label() {
        return this._label;
    }

    get segmentLabels() {
        return this._segmentLabels;
    }

    get pointPrimitives() {
        return this._polyline.pointPrimitives;
    }

    get polylinePrimitive() {
        return this._polyline.polylinePrimitive;
    }

    get polyline() {
        return this._polyline;
    }

    showHide(show: boolean) {
        this._label.show = show;

        if (show && this.polylinePrimitive.positions.length === 2) {
            this._label.show = false;
        }

        for (let i = 0; i < this._segmentLabels.length; i++) this._segmentLabels[i].show = show;

        this.polylinePrimitive.show = show;

        for (let i = 0; i < this.pointPrimitives.length; i++) this.pointPrimitives[i].show = show;
    }

    getDetail(): Object {
        return this.polylinePrimitive.positions;
    }

    calcDistance() {
        const positions = this.polylinePrimitive.positions;

        if (positions.length < 2) {
            return 0;
        }

        let distance = 0;
        for (let i = 0; i < positions.length - 1; i++) {
            distance += Cartesian3.distance(positions[i], positions[i + 1]);
        }

        return distance;
    }

    updateLabels() {
        for (let i = 0; i < this._segmentLabels.length; i++) {
            this._labelCollection.remove(this._segmentLabels[i]);
        }

        this._segmentLabels.length = 0;

        const positions = this._polyline.polylinePrimitive.positions;

        for (let i = 0; i < positions.length - 1; i++) {
            const label = this._labelCollection.add(
                PrimitiveSettings.getLabelOptions({
                    show: true,
                    scale: 0.8,
                    horizontalOrigin: HorizontalOrigin.LEFT,
                    verticalOrigin: VerticalOrigin.TOP,
                    pixelOffset: new Cartesian2(5, 5)
                })
            );

            label.position = Cartesian3.midpoint(positions[i], positions[i + 1], new Cartesian3());
            const distance = Cartesian3.distance(positions[i], positions[i + 1]);
            label.text = MeasureUnits.distanceToString(
                distance,
                this._parentTool.selectedUnits.distanceUnits,
                this._parentTool.selectedLocale,
                fractions
            );

            this._segmentLabels.push(label);
        }

        const distance = this.calcDistance();
        this._label.text = MeasureUnits.distanceToString(
            distance,
            this._parentTool.selectedUnits.distanceUnits,
            this._parentTool.selectedLocale,
            fractions
        );

        this._label.position = calculateMostTopPosition(this._parentTool.scene, positions, new Cartesian3());
    }

    private _onVertexChanged() {
        this.updateLabels();
        this.updated.raiseEvent();
    }

    isContain(primitive: any): boolean {
        if (Object.is(primitive, this._label)) {
            return true;
        }

        for (let i = 0; i < this._segmentLabels.length; i++) {
            if (Object.is(primitive, this._segmentLabels[i])) {
                return true;
            }
        }

        return this._polyline.isContained(primitive);
    }

    measurementString(): string {
        let ret = "";
        const positions = this._polyline.polylinePrimitive.positions;

        for (let i = 0; i < positions.length - 1; i++) {
            const distance = Cartesian3.distance(positions[i], positions[i + 1]);

            ret += `Segment ${i + 1}: ${MeasureUnits.distanceToString(
                distance,
                this._parentTool.selectedUnits.distanceUnits,
                this._parentTool.selectedLocale,
                fractions
            )} \n`;
        }

        const distance = this.calcDistance();

        ret += `Total Length: ${MeasureUnits.distanceToString(
            distance,
            this._parentTool.selectedUnits.distanceUnits,
            this._parentTool.selectedLocale,
            fractions
        )}`;

        return ret;
    }
}
