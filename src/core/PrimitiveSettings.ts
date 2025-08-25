/* qeslint-disable */
// q@ts-nocheck

import {
    Cartesian2,
    Cartesian3,
    ClassificationType,
    Color,
    defaultValue,
    defined,
    Ellipsoid,
    HorizontalOrigin,
    LabelStyle,
    VerticalOrigin
} from "cesium";

const defaultLabelPixelOffset = new Cartesian2(0, -9);

export interface PointOptions {
    pixelSize?: number;
    color?: Color;
    position?: Cartesian3;
    disableDepthTestDistance?: number;
    show?: boolean;
}

export interface LabelOptions {
    show?: boolean;
    font?: string;
    outlineColor?: Color;
    outlineWidth?: number;
    style?: LabelStyle;
    text?: string;
    scale?: number;
    fillColor?: Color;
    showBackground?: boolean;
    backgroundColor?: Color;
    backgroundPadding?: Cartesian2;
    horizontalOrigin?: HorizontalOrigin;
    verticalOrigin?: VerticalOrigin;
    pixelOffset?: Cartesian2;
    disableDepthTestDistance?: number;
    position?: Cartesian3;
}

export interface PolylineOptions {
    show?: boolean;
    ellipsoid?: Ellipsoid;
    width?: number;
    color?: Color;
    depthFailColor?: Color;
    id?: string;
    positions?: Cartesian3[];
    materialType?: string;
    depthFailMaterialType?: string;
    loop?: boolean;
    clampToGround?: boolean;
    classificationType?: ClassificationType;
    allowPicking?: boolean;
}

export interface PolygonOptions {
    show?: boolean;
    ellipsoid?: Ellipsoid;
    width?: number;
    color?: Color;
    depthFailColor?: Color;
    id?: string;
    positions?: Cartesian3[];
    clampToGround?: boolean;
    classificationType?: ClassificationType;
    allowPicking?: boolean;
}

export class PrimitiveSettings {
    static color = Color.YELLOW;
    static labelFont = "16px Lucida Console";
    static textColor = Color.WHITE;
    static backgroundColor = new Color(0.165, 0.165, 0.165, 0.8);
    static backgroundPadding = new Cartesian2(7, 5);

    static getPolylineOptions(options: PolylineOptions = {}) {
        return {
            show: defaultValue(options.show, true),
            ellipsoid: options.ellipsoid,
            width: defaultValue(options.width, 3),
            color: defaultValue(options.color, PrimitiveSettings.color),
            depthFailColor: defaultValue(defaultValue(options.depthFailColor, options.color), PrimitiveSettings.color),
            id: options.id,
            positions: options.positions,
            materialType: options.materialType,
            depthFailMaterialType: options.depthFailMaterialType,
            loop: options.loop,
            clampToGround: options.clampToGround,
            classificationType: options.classificationType,
            allowPicking: defaultValue(options.allowPicking, true)
        };
    }

    static getPolygonOptions(options: PolygonOptions = {}) {
        return {
            show: defaultValue(options.show, true),
            ellipsoid: options.ellipsoid,
            color: defaultValue(options.color, PrimitiveSettings.color),
            depthFailColor: defaultValue(defaultValue(options.depthFailColor, options.color), PrimitiveSettings.color),
            id: options.id,
            positions: options.positions,
            clampToGround: options.clampToGround,
            classificationType: options.classificationType,
            allowPicking: defaultValue(options.allowPicking, true)
        };
    }

    static getPointOptions(options: PointOptions = {}) {
        return {
            pixelSize: defaultValue(options.pixelSize, 10),
            color: defaultValue(options.color, PrimitiveSettings.color),
            position: defaultValue(options.position, new Cartesian3()),
            disableDepthTestDistance: Number.POSITIVE_INFINITY, // for draw-over
            show: defaultValue(options.show, false)
        };
    }

    static getLabelOptions(options: LabelOptions = {}) {
        const ret = {
            show: defaultValue(options.show, false),
            font: defaultValue(options.font, PrimitiveSettings.labelFont),
            style: defaultValue(options.style, LabelStyle.FILL),
            text: defaultValue(options.text, ""),
            scale: defaultValue(options.scale, 1.0),
            fillColor: defaultValue(options.fillColor, PrimitiveSettings.textColor),
            showBackground: defaultValue(options.showBackground, true),
            backgroundColor: defaultValue(options.backgroundColor, PrimitiveSettings.backgroundColor),
            backgroundPadding: defaultValue(options.backgroundPadding, PrimitiveSettings.backgroundPadding),
            horizontalOrigin: defaultValue(options.horizontalOrigin, HorizontalOrigin.CENTER),
            verticalOrigin: defaultValue(options.verticalOrigin, VerticalOrigin.BOTTOM),
            pixelOffset: defined(options.pixelOffset) ? options.pixelOffset : Cartesian2.clone(defaultLabelPixelOffset),
            disableDepthTestDistance: defaultValue(options.disableDepthTestDistance, Number.POSITIVE_INFINITY), // for draw-over
            position: defaultValue(options.position, new Cartesian3())
        };

        if (ret.style === LabelStyle.OUTLINE || ret.style === LabelStyle.FILL_AND_OUTLINE) {
            options.outlineColor = defaultValue(options.outlineColor, Color.BLACK);
            options.outlineWidth = defaultValue(options.outlineWidth, 1);
        }

        return ret;
    }
}
