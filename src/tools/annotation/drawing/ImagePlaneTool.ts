/* qeslint-disable */
// q@ts-nocheck

import {
    Cartesian2,
    Cartesian3,
    Cartographic,
    createGuid,
    Event,
    PointPrimitive,
    PointPrimitiveCollection,
    PrimitiveCollection
} from "cesium";
import {
    DotCirclePrimitive,
    getSlopeAndAspect,
    getSurfaceNormal,
    MapToolConstructorOptions,
    MouseEvent,
    PrimitiveSettings,
    TilesetAssetGroup
} from "../../../core";

import { DrawingTool, ImagePlaneDrawingData } from "./DrawingTool";
import { ImagePlane } from "./ImagePlane";

export enum ImagePlaneCreateMode {
    OnePoint = 1,
    ThreePoint = 2
}

export enum ImagePlaneThreePointModeSteps {
    FirstStep = 1,
    SecondStep = 2,
    ThirdStep = 3
}

const positionFromMouseScratch = new Cartesian3();

export class ImagePlaneTool extends DrawingTool {
    private readonly _imagePlaneCreated: Event;
    private _dotCirclePrimitive: DotCirclePrimitive;
    private _tilesetAssetGroup: TilesetAssetGroup | undefined;
    private _createMode: ImagePlaneCreateMode;
    private _threePointModeStep: ImagePlaneThreePointModeSteps;
    private _pointPrimitiveCollection: PointPrimitiveCollection;
    private _threePointModeFirstPoint: PointPrimitive;
    private _threePointModeSecondPoint: PointPrimitive;
    private _threePointModeThirdPoint: PointPrimitive;

    private _testCenterPoint: PointPrimitive;

    private _threePointModeFirstPosition: Cartesian3 = new Cartesian3();
    private _threePointModeSecondPosition: Cartesian3 = new Cartesian3();
    private _threePointModeThirdPosition: Cartesian3 = new Cartesian3();
    private _imagePlane: ImagePlane | undefined;

    constructor(options: MapToolConstructorOptions) {
        super(options);

        this._createMode = ImagePlaneCreateMode.OnePoint;
        this._threePointModeStep = ImagePlaneThreePointModeSteps.FirstStep;
        const scene = this.scene;

        const primitiveCollection = new PrimitiveCollection();

        const primitives = scene.primitives.add(primitiveCollection);

        this._dotCirclePrimitive = primitives.add(
            new DotCirclePrimitive({
                show: false,
                allowPicking: false
            })
        );

        this._pointPrimitiveCollection = new PointPrimitiveCollection();

        scene.primitives.add(this._pointPrimitiveCollection);

        const pointOptions = PrimitiveSettings.getPointOptions();

        this._threePointModeFirstPoint = this._pointPrimitiveCollection.add(pointOptions);
        this._threePointModeSecondPoint = this._pointPrimitiveCollection.add(pointOptions);
        this._threePointModeThirdPoint = this._pointPrimitiveCollection.add(pointOptions);
        this._testCenterPoint = this._pointPrimitiveCollection.add(pointOptions);

        this._imagePlaneCreated = new Event();
    }

    get imagePlaneCreated() {
        return this._imagePlaneCreated;
    }

    get imagePlanes() {
        return this._drawings;
    }

    activate(options: { tilesetAssetGroup: TilesetAssetGroup; createMode: ImagePlaneCreateMode }): void {
        super.activate();

        this._tilesetAssetGroup = options.tilesetAssetGroup;
        this._createMode = options.createMode;

        if (this._createMode === ImagePlaneCreateMode.OnePoint) {
            this._dotCirclePrimitive.show = true;
        } else if (this._createMode === ImagePlaneCreateMode.ThreePoint) {
            this._threePointModeStep = ImagePlaneThreePointModeSteps.FirstStep;
        }
    }

    deactivate(deactivateOptions: any) {
        super.deactivate(deactivateOptions);

        this._dotCirclePrimitive.show = false;
        this._threePointModeFirstPoint.show = false;
        this._threePointModeSecondPoint.show = false;
        this._threePointModeThirdPoint.show = false;
    }

    get imagePlane() {
        return this._imagePlane;
    }

    loadData(data: ImagePlaneDrawingData, id: string) {
        const imagePlane = new ImagePlane({
            id: id,
            scene: this._viewer.scene,
            position: data.position,
            normal: data.normal,
            distance: data.distance,
            dimensions: data.dimensions,
            hpr: data.hpr,
            url: data.url,
            keepImageAspect: data.keepImageAspect
        });

        this._drawings.push(imagePlane);
    }

    removeDrawingById(id: string) {
        const drawingResults = this._drawings;

        const index = drawingResults.findIndex((drawingResult) => drawingResult.id === id);

        if (index === -1) {
            return false;
        }

        const foundDrawing = drawingResults[index] as ImagePlane;

        foundDrawing.destroy();

        drawingResults.splice(index, 1);

        return true;
    }

    canvasClickEvent(event: MouseEvent): void {
        if (this._createMode === ImagePlaneCreateMode.OnePoint) {
            this.canvasClickEventForOnePoint(event);
        } else if (this._createMode === ImagePlaneCreateMode.ThreePoint) {
            this.canvasClickEventForThreePoint(event);
        }
    }

    canvasClickEventForOnePoint(event: MouseEvent) {
        if (!this._tilesetAssetGroup) {
            return;
        }

        const position = this.getWorldPositionOn3DTiles(event.pos, new Cartesian3());

        if (!position) {
            return;
        }

        const surfaceNormal = getSurfaceNormal(this.scene, position, event.pos);

        if (!surfaceNormal) {
            return;
        }

        const dimension = this._calcDimension(position);

        const clippingPlanes: { enabled: boolean; activated: boolean }[] = [];

        this._tilesetAssetGroup.assets.forEach(() => {
            clippingPlanes.push({ activated: true, enabled: true });
        });

        const imagePlane = new ImagePlane({
            id: createGuid(),
            scene: this._viewer.scene,
            position: position,
            normal: surfaceNormal,
            distance: 0,
            dimensions: new Cartesian2(dimension, dimension),
            keepImageAspect: false
        });

        this._imagePlane = imagePlane;

        this._drawings.push(imagePlane);
        // @ts-ignore
        this._imagePlaneCreated.raiseEvent(this._drawings.length - 1);

        this._dotCirclePrimitive.show = false;
    }

    canvasClickEventForThreePoint(event: MouseEvent) {
        if (!this._tilesetAssetGroup) {
            return;
        }

        const position = this.getWorldPositionOn3DTiles(event.pos, new Cartesian3());

        if (!position) {
            return;
        }

        if (this._threePointModeStep === ImagePlaneThreePointModeSteps.FirstStep) {
            Cartesian3.clone(position, this._threePointModeFirstPosition);
            this._threePointModeFirstPoint.position = position;
            this._threePointModeFirstPoint.show = true;

            this._threePointModeStep = ImagePlaneThreePointModeSteps.SecondStep;
        } else if (this._threePointModeStep === ImagePlaneThreePointModeSteps.SecondStep) {
            Cartesian3.clone(position, this._threePointModeSecondPosition);
            this._threePointModeSecondPoint.position = position;
            this._threePointModeSecondPoint.show = true;

            this._threePointModeStep = ImagePlaneThreePointModeSteps.ThirdStep;
        } else if (this._threePointModeStep === ImagePlaneThreePointModeSteps.ThirdStep) {
            Cartesian3.clone(position, this._threePointModeThirdPosition);

            this._threePointModeFirstPoint.show = false;
            this._threePointModeSecondPoint.show = false;
            this._threePointModeThirdPoint.show = false;

            const mid = Cartesian3.add(
                this._threePointModeFirstPosition,
                this._threePointModeSecondPosition,
                new Cartesian3()
            );

            Cartesian3.add(mid, this._threePointModeThirdPosition, mid);
            Cartesian3.multiplyByScalar(mid, 1 / 3, mid);

            // this._testCenterPoint.show = true;
            this._testCenterPoint.position = mid;

            const v0 = Cartesian3.subtract(
                this._threePointModeFirstPosition,
                this._threePointModeSecondPosition,
                new Cartesian3()
            );
            const v1 = Cartesian3.subtract(
                this._threePointModeThirdPosition,
                this._threePointModeSecondPosition,
                new Cartesian3()
            );
            const cross = Cartesian3.cross(v0, v1, v0);

            Cartesian3.normalize(cross, cross);

            const dimension = this._calcDimension(position);

            const clippingPlanes: { enabled: boolean; activated: boolean }[] = [];

            this._tilesetAssetGroup.assets.forEach(() => {
                clippingPlanes.push({ activated: true, enabled: true });
            });

            const imagePlane = new ImagePlane({
                id: createGuid(),
                scene: this._viewer.scene,
                position: mid,
                normal: cross,
                distance: 0,
                dimensions: new Cartesian2(dimension, dimension),
                keepImageAspect: false
            });

            this._drawings.push(imagePlane);
            // @ts-ignore
            this._imagePlaneCreated.raiseEvent(this._drawings.length - 1);
        }
    }

    canvasMoveEvent(event: MouseEvent): void {
        if (this._createMode === ImagePlaneCreateMode.OnePoint) {
            this.canvasMoveEventForOnePoint(event);
        } else if (this._createMode === ImagePlaneCreateMode.ThreePoint) {
            this.canvasMoveEventForThreePoints(event);
        }
    }

    canvasMoveEventForOnePoint(event: MouseEvent) {
        if (event.button !== undefined) {
            return;
        }

        const scene = this.scene;

        const pickedPosition = this.getWorldPosition(event.pos, positionFromMouseScratch);

        if (!pickedPosition) {
            return;
        }

        const slopeAndAspect = getSlopeAndAspect(scene, event.pos);

        if (!slopeAndAspect) {
            return;
        }

        this._dotCirclePrimitive.setModelMatrix(pickedPosition, slopeAndAspect.aspect, slopeAndAspect.slope);
    }

    canvasMoveEventForThreePoints(event: MouseEvent) {
        if (event.button !== undefined) {
            return;
        }

        const pickedPosition = this.getWorldPosition(event.pos, positionFromMouseScratch);

        if (!pickedPosition) {
            return;
        }

        if (this._threePointModeStep === ImagePlaneThreePointModeSteps.FirstStep) {
            this._threePointModeFirstPoint.position = pickedPosition;
            this._threePointModeFirstPoint.show = true;
        } else if (this._threePointModeStep === ImagePlaneThreePointModeSteps.SecondStep) {
            this._threePointModeSecondPoint.position = pickedPosition;
            this._threePointModeSecondPoint.show = true;
        } else if (this._threePointModeStep === ImagePlaneThreePointModeSteps.ThirdStep) {
            this._threePointModeThirdPoint.position = pickedPosition;
            this._threePointModeThirdPoint.show = true;
        }
    }

    _calcDimension(position: Cartesian3) {
        const scene = this._viewer.scene;
        const camera = scene.camera;
        const distance = Cartesian3.distance(camera.position, position);
        // @ts-ignore
        const fov = camera.frustum.fov;
        const height = Math.tan(fov / 2) * distance;
        // @ts-ignore
        const width = camera.frustum.aspectRatio * height;
        const carto = Cartographic.fromCartesian(position);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const verticalHeight = camera.positionCartographic.height - carto.height;

        const ratio = 4;

        return width / ratio;
    }
}
