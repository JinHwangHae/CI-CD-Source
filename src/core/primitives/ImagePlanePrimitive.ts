import {
    Cartesian2,
    Color,
    ColorGeometryInstanceAttribute,
    defined,
    // @ts-ignore
    FrameState,
    GeometryInstance,
    Material,
    MaterialAppearance,
    PerInstanceColorAppearance,
    PlaneGeometry,
    PlaneOutlineGeometry,
    Primitive,
    VertexFormat
} from "cesium";

import { PlanePrimitive, PlanePrimitiveConstructorOptions } from "./PlanePrimitive";

declare type ConstructorOptions = PlanePrimitiveConstructorOptions & {
    url?: string;
    enableBorder?: boolean;
    keepImageAspect?: boolean;
};

export class ImagePlanePrimitive extends PlanePrimitive {
    private _imageUrl: string = "";
    private _enableBorder = false;
    private _updateImage = false;
    private _image = new Image();
    private _imageReady = false;
    private _keepImageAspect = false;

    constructor(options: ConstructorOptions) {
        super(options);

        this._image.onload = () => {
            this._imageReady = true;
        };

        if (options.url) {
            this._imageUrl = options.url;
            this._image.src = options.url;
        }

        if (defined(options.enableBorder)) {
            this._enableBorder = options.enableBorder!;
        }

        if (defined(options.keepImageAspect)) {
            this._keepImageAspect = options.keepImageAspect!;
        }

        this._createPrimitives();
    }

    get imageUrl() {
        return this._imageUrl;
    }

    set imageUrl(url) {
        if (this._imageUrl === url) {
            return;
        }

        this._imageUrl = url;
        this._update = true;
        this._updateImage = true;

        this._imageReady = false;
        this._image.src = url;
    }

    get keepImageAspect() {
        return this._keepImageAspect;
    }

    set keepImageAspect(val) {
        this._keepImageAspect = val;
        this._setDimensionYWithImageAspect();

        this._update = true;
    }

    _createPrimitives() {
        const planeGeometry = new PlaneGeometry({
            vertexFormat: VertexFormat.DEFAULT
        });

        const planeGeometryInstance = new GeometryInstance({
            geometry: planeGeometry
        });

        this._primitive = new Primitive({
            show: true,
            geometryInstances: planeGeometryInstance,
            appearance: new MaterialAppearance({
                material: new Material({
                    fabric: {
                        type: "Image",
                        uniforms: {
                            image: this._imageUrl
                        }
                    }
                })
            }),
            modelMatrix: this._modelMatrix,
            allowPicking: true,
            asynchronous: false
        });

        if (this._enableBorder) {
            const planeOutlineGeometry = new PlaneOutlineGeometry();

            const planeOutlineGeometryInstance = new GeometryInstance({
                geometry: planeOutlineGeometry,

                attributes: {
                    color: ColorGeometryInstanceAttribute.fromColor(Color.WHITE)
                }
            });

            this._outlinePrimitive = new Primitive({
                show: true,
                geometryInstances: planeOutlineGeometryInstance,
                appearance: new PerInstanceColorAppearance({
                    flat: true
                }),
                modelMatrix: this._modelMatrix,
                allowPicking: false,
                asynchronous: false
            });
        }
    }

    update(frameState: FrameState) {
        if (!this._show) {
            return;
        }

        if (this._update) {
            this._update = false;

            if (this._updateImage) {
                if (this._primitive) {
                    this._primitive.destroy();
                }

                this._createPrimitives();

                this._updateImage = false;
            } else {
                this._updateModelMatrix();

                if (this._primitive) {
                    this._primitive.modelMatrix = this._modelMatrix;
                }
            }
        }

        // @ts-ignore
        this._primitive!.update(frameState);

        if (this._enableBorder) {
            // @ts-ignore
            this._outlinePrimitive!.update(frameState);
        }
    }

    _setDimensionYWithImageAspect() {
        if (!this._imageReady) {
            return;
        }

        const dimensions = this.dimensions;

        const dimensionX = dimensions.x;

        const imageAspect = this._image.width / this._image.height;

        const dimensionY = dimensionX / imageAspect;

        this.dimensions = new Cartesian2(dimensionX, dimensionY);
    }

    setDimensionX(val: number) {
        const dimensions = this.dimensions;

        dimensions.x = val;

        if (this._keepImageAspect) {
            if (this._imageReady) {
                const imageAspect = this._image.width / this._image.height;

                dimensions.y = val / imageAspect;
            } else {
                console.warn("image not ready");
            }
        }

        this.dimensions = dimensions;
    }

    setDimensionY(val: number) {
        const dimensions = this.dimensions;

        dimensions.y = val;

        if (this._keepImageAspect) {
            if (this._imageReady) {
                const imageAspect = this._image.width / this._image.height;

                dimensions.x = val * imageAspect;
            } else {
                console.warn("image not ready");
            }
        }

        this.dimensions = dimensions;
    }
}
