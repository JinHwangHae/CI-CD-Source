import {
    Billboard,
    BillboardCollection,
    Cartesian2,
    Cartesian3,
    Cartographic,
    Color,
    createGuid,
    IntersectionTests,
    Label,
    LabelCollection,
    LabelStyle,
    Plane,
    PointPrimitiveCollection,
    PrimitiveCollection,
    Ray,
    Scene,
    VerticalOrigin
} from "cesium";

import {
    DotCirclePrimitive,
    getSlopeAndAspect,
    getWorldPosition,
    LabelOptions,
    MapToolConstructorOptions,
    MouseEvent,
    PolylinePrimitive,
    PrimitiveSettings
} from "../../../core";

import { getOffsetedPosition } from "../EditCommon";
import { DrawingTool, NoteDrawingData } from "./DrawingTool";
import { NoteDrawing } from "./NoteDrawing";

const positionFromMouseScratch = new Cartesian3();
const offsetedPositionScratch = new Cartesian3();
const rayScratch = new Ray();
const intersectScratch = new Cartesian3();
const verticalScreenPosScratch = new Cartesian2();
const planeNormalScratch = new Cartesian3();
const surfaceNormalScratch = new Cartesian3();

enum State {
    BeforeCreated = 1, // a dot circle is created but note is not created yet
    NoteCreated = 2 // note created
}

declare type BillboardOptions = {
    image: string;
    disableDepthTestDistance: number;
    width: 23;
    height: 33;
    pixelOffset: Cartesian2;
    show: false;
};

declare type ConstructorOptions = MapToolConstructorOptions & {
    scene: Scene;
    primitives: PrimitiveCollection;
    labels: LabelCollection;
    billboards: BillboardCollection;
};

export class NoteDrawingTool extends DrawingTool {
    private _state: State;
    private _label: Label | undefined;
    private _billboard: Billboard | undefined;
    private readonly _primitiveCollection: PrimitiveCollection;
    private readonly _labels: LabelCollection;
    private readonly _billboards: BillboardCollection;
    private readonly _labelOptions: LabelOptions;
    private readonly _billboardOptions: BillboardOptions;
    private _dottedPolylinePrimitive: PolylinePrimitive;
    private _dotCirclePrimitive: DotCirclePrimitive;
    private readonly _mousePositionWhenNoteCreated: Cartesian2 = new Cartesian2();
    private _verticalPlaneWhenNoteCreated: Plane = new Plane(Cartesian3.UNIT_X, 0);
    private readonly _dotCirclePosition = new Cartesian3();
    private readonly _pointPrimitiveCollection = new PointPrimitiveCollection();

    constructor(options: ConstructorOptions) {
        super(options);

        this._state = State.BeforeCreated;
        this._primitiveCollection = options.primitives;

        this._labels = options.labels;
        this._labelOptions = PrimitiveSettings.getLabelOptions({
            font: "32px Helvetica",
            style: LabelStyle.FILL_AND_OUTLINE,
            outlineColor: Color.BLACK,
            outlineWidth: 2,
            scale: 0.8,
            fillColor: Color.fromCssColorString("rgba(255,255,0,1)"),
            verticalOrigin: VerticalOrigin.TOP,
            pixelOffset: new Cartesian2(0, -34),
            showBackground: false
        });

        const svg =
            "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAxNCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTcgMEMzLjEzIDAgMCAzLjEzIDAgN0MwIDEyLjI1IDcgMjAgNyAyMEM3IDIwIDE0IDEyLjI1IDE0IDdDMTQgMy4xMyAxMC44NyAwIDcgMFpNNyA5LjVDNS42MiA5LjUgNC41IDguMzggNC41IDdDNC41IDUuNjIgNS42MiA0LjUgNyA0LjVDOC4zOCA0LjUgOS41IDUuNjIgOS41IDdDOS41IDguMzggOC4zOCA5LjUgNyA5LjVaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K";

        this._billboardOptions = {
            image: svg,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            width: 23,
            height: 33,
            pixelOffset: new Cartesian2(0, -12),
            show: false
        };

        this._billboards = options.billboards;

        this._dottedPolylinePrimitive = this._primitiveCollection.add(
            new PolylinePrimitive({
                color: Color.WHITE,
                width: 2,
                dashed: true,
                allowPicking: true
            })
        );

        this._dotCirclePrimitive = this._primitiveCollection.add(
            new DotCirclePrimitive({
                show: false
            })
        );

        this._primitiveCollection.add(this._pointPrimitiveCollection);
    }

    activate(): void {
        super.activate();
        this._dotCirclePrimitive.show = true;
    }

    canvasMoveEvent(event: MouseEvent): void {
        if (this._state === State.BeforeCreated) {
            const scene = this.scene;

            const pickedPosition = getWorldPosition(scene, event.pos, positionFromMouseScratch);

            if (!pickedPosition) {
                return;
            }

            const slopeAndAspect = getSlopeAndAspect(scene, event.pos);

            if (!slopeAndAspect) {
                return;
            }

            Cartesian3.clone(pickedPosition, this._dotCirclePosition);

            this._dotCirclePrimitive.setModelMatrix(pickedPosition, slopeAndAspect.aspect, slopeAndAspect.slope);
        }

        if (this._state === State.NoteCreated) {
            this._determineVerticalPlane();

            if (!this._verticalPlaneWhenNoteCreated) {
                return;
            }

            const verticalScreenPos = Cartesian2.clone(this._mousePositionWhenNoteCreated, verticalScreenPosScratch);

            verticalScreenPos.y = event.pos.y;

            const ray = this.scene.camera.getPickRay(verticalScreenPos, rayScratch);

            if (!ray) {
                return;
            }

            const intersect = IntersectionTests.rayPlane(ray, this._verticalPlaneWhenNoteCreated, intersectScratch);

            if (!intersect) {
                return;
            }

            const intersectionCarto = Cartographic.fromCartesian(intersect);
            const dotCircleCarto = Cartographic.fromCartesian(this._dotCirclePosition);

            const pos = Cartesian3.fromRadians(
                dotCircleCarto.longitude,
                dotCircleCarto.latitude,
                intersectionCarto.height
            );

            this._label!.position = pos;
            this._billboard!.position = pos;
            this._dottedPolylinePrimitive.positions = [this._dotCirclePosition, pos];
        }
    }

    _determineVerticalPlane() {
        const surfaceNormal = Cartesian3.normalize(this._dotCirclePosition, surfaceNormalScratch);
        const camera = this.scene.camera;

        const planeNormal = Cartesian3.cross(surfaceNormal, camera.right, planeNormalScratch);

        /**
         * plane equation
         * Ax + By + Cz + D = 0;
         *
         * distance between the given point(x, y, z) and the plane.
         *
         * d = |Ax + By + Cz + D| / squre(A * A + B * B + C * C)
         *
         * distance between the origin(0, 0, 0) and the plane.
         *
         * d = |D| / squre(A * A + B * B + C * C)
         */

        const A = planeNormal.x;
        const B = planeNormal.y;
        const C = planeNormal.z;

        const D = A * planeNormal.x + B * planeNormal.y + C * planeNormal.z;

        const distance = Math.abs(D) / Math.sqrt(A * A + B * B + C * C);

        this._verticalPlaneWhenNoteCreated.normal = planeNormal;
        this._verticalPlaneWhenNoteCreated.distance = distance;
    }

    canvasClickEvent(event: MouseEvent) {
        if (this._state === State.BeforeCreated) {
            const pickedPosition = getWorldPosition(this.scene, event.pos, positionFromMouseScratch);

            if (!pickedPosition) return;

            const count = this._labels.length;

            this._label = this._labels.add({
                ...this._labelOptions,
                show: true,
                position: pickedPosition,
                text: `Note ${count}`
            });

            this._billboard = this._billboards.add({
                ...this._billboardOptions,
                position: pickedPosition
            });

            this._state = State.NoteCreated;
            Cartesian2.clone(event.pos, this._mousePositionWhenNoteCreated);
        } else if (this._state === State.NoteCreated) {
            this._drawings.push(
                new NoteDrawing({
                    id: createGuid(),
                    label: this._label!,
                    billboard: this._billboard!,
                    dottedPolyline: this._dottedPolylinePrimitive,
                    dotCircle: this._dotCirclePrimitive,
                    topPointPrimitive: this._pointPrimitiveCollection.add({}),
                    bottomPointPrimitive: this._pointPrimitiveCollection.add({})
                })
            );

            // @ts-ignore
            this._drawingFinished.raiseEvent(this._drawings.length - 1);
            this._reset();
        }
    }

    _reset() {
        this._state = State.BeforeCreated;

        this._dottedPolylinePrimitive = this._primitiveCollection.add(
            new PolylinePrimitive({
                color: Color.WHITE,
                width: 2,
                dashed: true
            })
        );

        this._dotCirclePrimitive = this._primitiveCollection.add(
            new DotCirclePrimitive({
                show: true
            })
        );
    }

    loadData(data: NoteDrawingData, id: string) {
        const position = new Cartesian3(data.position.x, data.position.y, data.position.z);

        const label = this._labels.add({
            ...this._labelOptions,
            show: data.showLabel,
            position: position,
            text: data.text,
            fillColor: data.color
        });

        const billboard = this._billboards.add({
            ...this._billboardOptions,
            show: data.showBillboard,
            position: position
        });

        const primitiveCollection = this._primitiveCollection;

        let distance = 1;

        if (data.distance) {
            distance = data.distance;
        }

        const offsetedPosition = getOffsetedPosition(position, -distance, offsetedPositionScratch);

        const dottedPolylinePrimitive = this._primitiveCollection.add(
            new PolylinePrimitive({
                show: data.showLeader,
                positions: [position, Cartesian3.clone(offsetedPosition, new Cartesian3())],
                color: Color.WHITE,
                width: 2,
                dashed: true,
                allowPicking: true
            })
        );
        const dotCirclePrimitive = primitiveCollection.add(
            new DotCirclePrimitive({
                show: data.showLeader,
                position: offsetedPosition,
                heading: data.heading ? data.heading : 0,
                pitch: data.pitch ? data.pitch : 0
            })
        );

        this._drawings.push(
            new NoteDrawing({
                id: id,
                label: label,
                billboard: billboard,
                dottedPolyline: dottedPolylinePrimitive,
                dotCircle: dotCirclePrimitive,
                topPointPrimitive: this._pointPrimitiveCollection.add({}),
                bottomPointPrimitive: this._pointPrimitiveCollection.add({})
            })
        );
    }

    removeDrawingById(id: string) {
        const drawingResults = this._drawings;

        const index = drawingResults.findIndex((drawingResult) => drawingResult.id === id);

        if (index === -1) {
            return false;
        }

        const foundDrawing = drawingResults[index] as NoteDrawing;

        this._labels.remove(foundDrawing.label);
        this._billboards.remove(foundDrawing.billboard);
        this._primitiveCollection.remove(foundDrawing.dottedPolyline);
        this._primitiveCollection.remove(foundDrawing.dotCircle);

        drawingResults.splice(index, 1);

        return true;
    }
}
