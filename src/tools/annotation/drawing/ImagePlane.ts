/* qeslint-disable */

import { Cartesian2, Cartesian3, Color, destroyObject, HeadingPitchRoll, Math as CesiumMath, Scene } from "cesium";

import { ImagePlanePrimitive } from "../../../core";
import { DrawingType } from "./common";
import { Drawing } from "./Drawing";

const defaultPlaneColor = Color.WHITE.withAlpha(0.1);

interface ConstructorOptions {
    id: string;
    scene: Scene;
    position: Cartesian3;
    normal: Cartesian3; // in world
    distance: number;
    dimensions: Cartesian2;
    hpr?: HeadingPitchRoll;
    url?: string;
    keepImageAspect: boolean;
}

export class ImagePlane extends Drawing {
    private readonly _scene: Scene;
    private _planePrimitive: ImagePlanePrimitive;

    constructor(options: ConstructorOptions) {
        super({
            id: options.id,
            type: DrawingType.ImagePlane
        });

        const scene = options.scene;

        this._scene = scene;

        this._planePrimitive = scene.primitives.add(
            new ImagePlanePrimitive({
                position: options.position,
                normal: options.normal,
                dimensions: options.dimensions,
                distance: options.distance,
                color: defaultPlaneColor,
                hpr: options.hpr,
                url: options.url,
                keepImageAspect: options.keepImageAspect
            })
        );
    }

    get planePrimitive() {
        return this._planePrimitive;
    }

    get hpr() {
        return this._planePrimitive.hpr;
    }

    setHeading(h: number) {
        const hpr = this.hpr;

        hpr.heading = CesiumMath.toRadians(h);

        this._planePrimitive.hpr = hpr;
    }

    setPitch(p: number) {
        const hpr = this.hpr;

        hpr.pitch = CesiumMath.toRadians(p);

        this._planePrimitive.hpr = hpr;
    }

    setRoll(r: number) {
        const hpr = this.hpr;

        hpr.roll = CesiumMath.toRadians(r);

        this._planePrimitive.hpr = hpr;
    }

    // eslint-disable-next-line class-methods-use-this, @typescript-eslint/no-unused-vars
    setColor(color: Color) {}

    showHide(show: boolean) {
        this._planePrimitive.show = show;
    }

    getDetail() {
        const planePrimitive = this._planePrimitive;

        return {
            position: planePrimitive.position,
            normal: planePrimitive.worldNormal,
            dimensions: planePrimitive.dimensions,
            distance: planePrimitive.distance,
            hpr: this.hpr,
            keepImageAspect: this._planePrimitive.keepImageAspect
        };
    }

    isContain(primitive: any) {
        return Object.is(primitive, this._planePrimitive.primitive);
    }

    setImage(imageUrl: string) {
        this._planePrimitive.imageUrl = imageUrl;
    }

    destroy() {
        this._scene.primitives.remove(this._planePrimitive);
        destroyObject(this);
    }
}
