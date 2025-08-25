/* qeslint-disable */
// q@ts-nocheck

import {
    Cartesian2,
    Cartesian3,
    Cartographic,
    Event,
    PointPrimitive,
    PointPrimitiveCollection,
    PrimitiveCollection
} from "cesium";
import {
    DotCirclePrimitive,
    getSlopeAndAspect,
    getSurfaceNormal,
    MapTool,
    MapToolConstructorOptions,
    MouseEvent,
    PrimitiveSettings,
    TilesetAssetGroup
} from "../../../core";

import { ClippingPlane, ClippingPlaneParameters } from "./ClippingPlane";

const positionFromMouseScratch = new Cartesian3();

export enum ClippingPlaneCreateMode {
    OnePoint = 1,
    ThreePoint = 2
}

export enum ThreePointModeSteps {
    FirstStep = 1,
    SecondStep = 2,
    ThirdStep = 3
}

export class ClippingPlaneTool extends MapTool {
    private readonly _clippingPlaneCreated: Event;
    private _dotCirclePrimitive: DotCirclePrimitive;
    private _tilesetAssetGroup: TilesetAssetGroup | undefined;
    private readonly _clippingPlanes: ClippingPlane[];
    private _createMode: ClippingPlaneCreateMode;
    private _threePointModeStep: ThreePointModeSteps;
    private _pointPrimitiveCollection: PointPrimitiveCollection;
    private _threePointModeFirstPoint: PointPrimitive;
    private _threePointModeSecondPoint: PointPrimitive;
    private _threePointModeThirdPoint: PointPrimitive;

    private _testCenterPoint: PointPrimitive;

    private _threePointModeFirstPosition: Cartesian3 = new Cartesian3();
    private _threePointModeSecondPosition: Cartesian3 = new Cartesian3();
    private _threePointModeThirdPosition: Cartesian3 = new Cartesian3();

    constructor(options: MapToolConstructorOptions) {
        super(options);

        this._createMode = ClippingPlaneCreateMode.OnePoint;

        this._threePointModeStep = ThreePointModeSteps.FirstStep;

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

        this._clippingPlanes = [];
        this._clippingPlaneCreated = new Event();
    }

    get clippingPlanes() {
        return this._clippingPlanes;
    }

    get clippingPlaneCreated() {
        return this._clippingPlaneCreated;
    }

    activate(options: { tilesetAssetGroup: TilesetAssetGroup; createMode: ClippingPlaneCreateMode }): void {
        super.activate();

        this._tilesetAssetGroup = options.tilesetAssetGroup;
        this._createMode = options.createMode;

        if (this._createMode === ClippingPlaneCreateMode.OnePoint) {
            this._dotCirclePrimitive.show = true;
        } else if (this._createMode === ClippingPlaneCreateMode.ThreePoint) {
            this._threePointModeStep = ThreePointModeSteps.FirstStep;
        }
    }

    deactivate(deactivateOptions: any) {
        super.deactivate(deactivateOptions);

        this._dotCirclePrimitive.show = false;
        this._threePointModeFirstPoint.show = false;
        this._threePointModeSecondPoint.show = false;
        this._threePointModeThirdPoint.show = false;
    }

    canvasClickEvent(event: MouseEvent): void {
        if (this._createMode === ClippingPlaneCreateMode.OnePoint) {
            this.canvasClickEventForOnePoint(event);
        } else if (this._createMode === ClippingPlaneCreateMode.ThreePoint) {
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

        Cartesian3.negate(surfaceNormal, surfaceNormal);

        const dimension = this._calcDimension(position);

        const clippingPlanes: { enabled: boolean; activated: boolean }[] = [];

        this._tilesetAssetGroup.assets.forEach(() => {
            clippingPlanes.push({ activated: true, enabled: true });
        });

        const clippingPlane = new ClippingPlane({
            viewer: this._viewer,
            assetGroup: this._tilesetAssetGroup,
            position: position,
            normal: surfaceNormal,
            distance: 0,
            dimensions: new Cartesian2(dimension, dimension),
            clippingPlanes: clippingPlanes
        });

        this._clippingPlanes.push(clippingPlane);
        // @ts-ignore
        this._clippingPlaneCreated.raiseEvent(this._clippingPlanes.length - 1);

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

        if (this._threePointModeStep === ThreePointModeSteps.FirstStep) {
            Cartesian3.clone(position, this._threePointModeFirstPosition);
            this._threePointModeFirstPoint.position = position;
            this._threePointModeFirstPoint.show = true;

            this._threePointModeStep = ThreePointModeSteps.SecondStep;
        } else if (this._threePointModeStep === ThreePointModeSteps.SecondStep) {
            Cartesian3.clone(position, this._threePointModeSecondPosition);
            this._threePointModeSecondPoint.position = position;
            this._threePointModeSecondPoint.show = true;

            this._threePointModeStep = ThreePointModeSteps.ThirdStep;
        } else if (this._threePointModeStep === ThreePointModeSteps.ThirdStep) {
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

            const clippingPlane = new ClippingPlane({
                viewer: this._viewer,
                assetGroup: this._tilesetAssetGroup,
                position: mid,
                normal: cross,
                distance: 0,
                dimensions: new Cartesian2(dimension, dimension),
                clippingPlanes: clippingPlanes
            });

            this._clippingPlanes.push(clippingPlane);
            // @ts-ignore
            this._clippingPlaneCreated.raiseEvent(this._clippingPlanes.length - 1);
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

    canvasMoveEvent(event: MouseEvent): void {
        if (this._createMode === ClippingPlaneCreateMode.OnePoint) {
            this.canvasMoveEventForOnePoint(event);
        } else if (this._createMode === ClippingPlaneCreateMode.ThreePoint) {
            this.canvasMoveEventForThreePoints(event);
        }
    }

    canvasMoveEventForThreePoints(event: MouseEvent) {
        if (event.button !== undefined) {
            return;
        }

        const pickedPosition = this.getWorldPosition(event.pos, positionFromMouseScratch);

        if (!pickedPosition) {
            return;
        }

        if (this._threePointModeStep === ThreePointModeSteps.FirstStep) {
            this._threePointModeFirstPoint.position = pickedPosition;
            this._threePointModeFirstPoint.show = true;
        } else if (this._threePointModeStep === ThreePointModeSteps.SecondStep) {
            this._threePointModeSecondPoint.position = pickedPosition;
            this._threePointModeSecondPoint.show = true;
        } else if (this._threePointModeStep === ThreePointModeSteps.ThirdStep) {
            this._threePointModeThirdPoint.position = pickedPosition;
            this._threePointModeThirdPoint.show = true;
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

    getClippingPlaneById(id: string) {
        const index = this._clippingPlanes.findIndex((clippingPlane) => clippingPlane.id === id);

        if (index === -1) {
            return undefined;
        }

        return this._clippingPlanes[index];
    }

    loadData(data: ClippingPlaneParameters) {
        const viewer = this._viewer;
        const tilesetAssetGroup = window.Construkted.tilesetAssetGroup;

        const clippingPlane = new ClippingPlane({ ...data, viewer: viewer, assetGroup: tilesetAssetGroup });

        this._clippingPlanes.push(clippingPlane);

        return clippingPlane;
    }

    removeClippingPlaneById(id: string) {
        const index = this._clippingPlanes.findIndex((clippingPlane) => clippingPlane.id === id);

        if (index === -1) {
            return false;
        }

        const clippingBox = this._clippingPlanes[index];

        clippingBox.destroy();

        this._clippingPlanes.splice(index, 1);

        return true;
    }

    storeStatus() {
        this._clippingPlanes.forEach((clippingPlane) => {
            clippingPlane.storeStatus();
        });
    }

    restoreStatus() {
        this._clippingPlanes.forEach((clippingPlane) => {
            clippingPlane.restoreStatus();
        });
    }

    activateClippingPlane(id: string) {
        for (let i = 0; i < this._clippingPlanes.length; i++) {
            const clippingPlane = this._clippingPlanes[i];

            clippingPlane.deactivate();
        }

        for (let i = 0; i < this._clippingPlanes.length; i++) {
            const clippingPlane = this._clippingPlanes[i];

            if (clippingPlane.id === id) {
                clippingPlane.activate();
            }
        }
    }
}
