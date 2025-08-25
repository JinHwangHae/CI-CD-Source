import { Billboard, Cartesian2, Cartesian3, Color, Label, Matrix4, PointPrimitive, Primitive } from "cesium";

import { DotCirclePrimitive, PolylinePrimitive } from "../../../core";
import { editingPointOptions } from "../EditCommon";
import { DrawingType } from "./common";
import { Drawing } from "./Drawing";

interface ConstructorOptions {
    id: string;
    label: Label;
    billboard: Billboard;
    dottedPolyline: PolylinePrimitive;
    dotCircle: DotCirclePrimitive;
    topPointPrimitive: PointPrimitive;
    bottomPointPrimitive: PointPrimitive;
}

export class NoteDrawing extends Drawing {
    private readonly _label: Label;
    private readonly _billboard: Billboard;
    private readonly _dottedPolyline: PolylinePrimitive;
    private readonly _dotCircle: DotCirclePrimitive;

    // only show when editing is activated
    private readonly _topPointPrimitive: PointPrimitive;

    // only show when editing is activated
    private readonly _bottomPointPrimitive: PointPrimitive;
    private readonly _originalLabelPosition = new Cartesian3();
    private readonly _originalDotCircleModelMatrix = new Matrix4();

    constructor(options: ConstructorOptions) {
        super({
            id: options.id,
            type: DrawingType.Note
        });

        this._label = options.label;
        this._billboard = options.billboard;
        this._dottedPolyline = options.dottedPolyline;
        this._dotCircle = options.dotCircle;
        this._topPointPrimitive = options.topPointPrimitive;
        this._bottomPointPrimitive = options.bottomPointPrimitive;
    }

    get label() {
        return this._label;
    }

    get billboard() {
        return this._billboard;
    }

    get dottedPolyline() {
        return this._dottedPolyline;
    }

    get dotCircle() {
        return this._dotCircle;
    }

    get distance() {
        return Cartesian3.distance(this._label.position, this._dotCircle.position);
    }

    setColor(color: Color): void {
        this._label.fillColor = color;
    }

    showHideBillboard(show: boolean) {
        if (show) {
            this._billboard.show = true;
            this._label.pixelOffset = new Cartesian2(0, -54);
        } else {
            this._billboard.show = false;
            this._label.pixelOffset = new Cartesian2(0, -34);
        }
    }

    showHideLabel(show: boolean) {
        this._label.show = show;
    }

    showHideLeader(show: boolean) {
        this._dottedPolyline.show = show;
        this._dotCircle.show = show;
    }

    getDetail() {
        const position = this._label.position;
        const hpr = this.dotCircle.headingPitchRoll;

        return {
            position: {
                x: position.x,
                y: position.y,
                z: position.z
            },
            heading: hpr.heading,
            pitch: hpr.pitch,
            distance: this.distance
        };
    }

    showHide(show: boolean): void {
        this._label.show = show;
        this._billboard.show = show;
        this._dottedPolyline.show = show;
        this._dotCircle.show = show;
    }

    startEditing() {
        let point = this._topPointPrimitive;

        point.show = true;
        point.position = this._label.position;
        point.color = editingPointOptions.color;
        point.pixelSize = editingPointOptions.pixelSize;
        point.outlineWidth = editingPointOptions.outlineWidth;
        point.outlineColor = editingPointOptions.outlineColor;
        point.disableDepthTestDistance = Number.POSITIVE_INFINITY;

        point = this._bottomPointPrimitive;

        point.show = true;
        point.position = this._dotCircle.position;
        point.color = editingPointOptions.color;
        point.pixelSize = editingPointOptions.pixelSize;
        point.outlineWidth = editingPointOptions.outlineWidth;
        point.outlineColor = editingPointOptions.outlineColor;
        point.disableDepthTestDistance = Number.POSITIVE_INFINITY;

        Cartesian3.clone(this._label.position, this._originalLabelPosition);
        Matrix4.clone(this._dotCircle.modelMatrix, this._originalDotCircleModelMatrix);
    }

    finishEditing(cancel: boolean) {
        if (cancel) {
            // revert logic

            this._label.position = this._originalLabelPosition;
            this._billboard.position = this._originalLabelPosition;
            this._dotCircle.modelMatrix = this._originalDotCircleModelMatrix;
            this._dottedPolyline.positions = [this._label.position, this._dotCircle.position];
        }
        this._topPointPrimitive.show = false;
        this._bottomPointPrimitive.show = false;
    }

    isTopPoint(primitive: Primitive) {
        return Object.is(this._topPointPrimitive, primitive);
    }

    isBottomPointOrDotCirclePolygon(primitive: Primitive) {
        if (Object.is(this._bottomPointPrimitive, primitive)) {
            return true;
        }

        return Object.is(this._dotCircle.polygonPrimitive.primitive, primitive);
    }

    updateLabelPosition(position: Cartesian3) {
        this._label.position = position;
        this._billboard.position = position;
        this._dottedPolyline.positions = [this._dotCircle.position, position];

        this._topPointPrimitive.position = position;
    }

    updateDotCircle(position: Cartesian3, slopeAndAspect: any) {
        this._bottomPointPrimitive.position = position;
        this._dotCircle.setModelMatrix(position, slopeAndAspect.aspect, slopeAndAspect.slope);
    }

    isContain(primitive: any): boolean {
        if (Object.is(primitive, this._label)) {
            return true;
        }

        if (Object.is(primitive, this.billboard)) {
            return true;
        }

        if (Object.is(primitive, this._dottedPolyline.primitive)) {
            return true;
        }

        if (this._dotCircle.isContain(primitive)) {
            return true;
        }

        return false;
    }
}
