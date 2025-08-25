import { HeadingPitchRoll, Math as CesiumMath, Cartographic, Cartesian3, Cartesian2 } from "cesium";
import { getImagePlane } from "./common";

export function initPlaceImageRelativeEvents() {
    const jQuery = window.jQuery;

    const jqAnnotationImage = jQuery("#annotation-image-plane-image");

    jqAnnotationImage.on("change", () => {
        const files = (jqAnnotationImage[0] as HTMLInputElement).files;

        if (!files) {
            return;
        }

        const imagePlane = getImagePlane();

        if (!imagePlane) {
            return;
        }

        const url = window.URL.createObjectURL(files[0]);

        imagePlane.setImage(url);
    });

    const jqImagePlaneScaleX = jQuery("#image-plane-scale-x");

    jqImagePlaneScaleX.change(() => {
        const dimensionX = parseFloat(jqImagePlaneScaleX.val() as string);

        if (Number.isNaN(dimensionX)) {
            jqImagePlaneScaleX.val("");
            alert(`invalid dimensionX: ${dimensionX}`);
            return;
        }

        const imagePlane = getImagePlane();

        if (!imagePlane) {
            return;
        }

        imagePlane.planePrimitive.setDimensionX(dimensionX);
    });

    const jqImagePlaneScaleY = jQuery("#image-plane-scale-y");

    jqImagePlaneScaleY.change(() => {
        const dimensionY = parseFloat(jqImagePlaneScaleY.val() as string);

        if (Number.isNaN(dimensionY)) {
            jqImagePlaneScaleY.val("");
            alert(`invalid dimensionY: ${dimensionY}`);
            return;
        }

        const imagePlane = getImagePlane();

        if (!imagePlane) {
            return;
        }

        imagePlane.planePrimitive.setDimensionY(dimensionY);
    });

    const jqImagePlaneLongitude = jQuery("#image-plane-position-longitude");

    jqImagePlaneLongitude.change(() => {
        const imagePlane = getImagePlane();

        if (!imagePlane) {
            return;
        }

        const position = imagePlane.planePrimitive.position;
        const carto = Cartographic.fromCartesian(position);
        const longitude = parseFloat(jqImagePlaneLongitude.val() as string);

        if (Number.isNaN(longitude)) {
            jqImagePlaneLongitude.val(CesiumMath.toDegrees(carto.longitude));
            alert(`invalid longitude: ${longitude}`);
            return;
        }

        carto.longitude = CesiumMath.toRadians(longitude);

        imagePlane.planePrimitive.position = Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height);
    });

    const jqImagePlaneLatitude = jQuery("#image-plane-position-latitude");

    jqImagePlaneLatitude.change(() => {
        const imagePlane = getImagePlane();

        if (!imagePlane) {
            return;
        }

        const position = imagePlane.planePrimitive.position;
        const carto = Cartographic.fromCartesian(position);
        const latitude = parseFloat(jqImagePlaneLatitude.val() as string);

        if (Number.isNaN(latitude)) {
            jqImagePlaneLatitude.val(CesiumMath.toDegrees(carto.latitude));
            alert(`invalid latitude: ${latitude}`);
            return;
        }

        carto.latitude = CesiumMath.toRadians(latitude);

        imagePlane.planePrimitive.position = Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height);
    });

    const jqImagePlaneHeight = jQuery("#image-plane-position-height");

    jqImagePlaneHeight.change(() => {
        const imagePlane = getImagePlane();

        if (!imagePlane) {
            return;
        }

        const position = imagePlane.planePrimitive.position;
        const carto = Cartographic.fromCartesian(position);
        const height = parseFloat(jqImagePlaneHeight.val() as string);

        if (Number.isNaN(height)) {
            jqImagePlaneHeight.val(carto.height);
            alert(`invalid height: ${height}`);
            return;
        }

        carto.height = height;

        imagePlane.planePrimitive.position = Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height);
    });

    const jqImageRotationHeading = jQuery("#image-plane-rotation-heading");

    jqImageRotationHeading.change(() => {
        const heading = parseFloat(jqImageRotationHeading.val() as string);

        if (Number.isNaN(heading)) {
            jqImageRotationHeading.val("");
            alert(`invalid heading: ${heading}`);
            return;
        }

        const imagePlane = getImagePlane();

        if (!imagePlane) {
            return;
        }

        imagePlane.setHeading(heading);
    });

    const jqImageRotationPitch = jQuery("#image-plane-rotation-pitch");

    jqImageRotationPitch.change(() => {
        const pitch = parseFloat(jqImageRotationPitch.val() as string);

        if (Number.isNaN(pitch)) {
            jqImageRotationPitch.val("");
            alert(`invalid pitch: ${pitch}`);
            return;
        }

        const imagePlane = getImagePlane();

        if (!imagePlane) {
            return;
        }

        imagePlane.setPitch(pitch);
    });

    const jqImageRotationRoll = jQuery("#image-plane-rotation-roll");

    jqImageRotationRoll.change(() => {
        const roll = parseFloat(jqImageRotationRoll.val() as string);

        if (Number.isNaN(roll)) {
            jqImageRotationRoll.val("");
            alert(`invalid roll: ${roll}`);
            return;
        }

        const imagePlane = getImagePlane();

        if (!imagePlane) {
            return;
        }

        imagePlane.setRoll(roll);
    });

    const imageEditTool = window.Construkted.imagePlaneEditTool;

    imageEditTool.positionChanged.addEventListener((pos: Cartesian3) => {
        const carto = Cartographic.fromCartesian(pos);

        jqImagePlaneLongitude.val(CesiumMath.toDegrees(carto.longitude).toFixed(5));
        jqImagePlaneLatitude.val(CesiumMath.toDegrees(carto.latitude).toFixed(5));
        jqImagePlaneHeight.val(carto.height.toFixed(1));
    });

    imageEditTool.hprChanged.addEventListener((hpr: HeadingPitchRoll) => {
        jqImageRotationHeading.val(CesiumMath.toDegrees(hpr.heading).toFixed(2));
        jqImageRotationPitch.val(CesiumMath.toDegrees(hpr.pitch).toFixed(2));
        jqImageRotationRoll.val(CesiumMath.toDegrees(hpr.roll).toFixed(2));
    });

    imageEditTool.scaleChanged.addEventListener((scale: Cartesian2) => {
        jqImagePlaneScaleX.val(scale.x.toFixed(3));
        jqImagePlaneScaleY.val(scale.y.toFixed(3));
    });

    const jqAnnotationImageAvancedToggle = jQuery("#annotation-image-advanced-toggle");

    jqAnnotationImageAvancedToggle.click(() => {
        jQuery("#annotation-image-advanced-content-container").toggleClass("hidden");

        if (jqAnnotationImageAvancedToggle.hasClass("icon-down")) {
            jqAnnotationImageAvancedToggle.removeClass("icon-down");
            jqAnnotationImageAvancedToggle.addClass("icon-up");
        } else {
            jqAnnotationImageAvancedToggle.removeClass("icon-up");
            jqAnnotationImageAvancedToggle.addClass("icon-down");
        }
    });

    const jqLockScaleToImageAspectCheckBox = jQuery("#lock-scale-to-image-aspect-checkbox");
    jqLockScaleToImageAspectCheckBox.change(function (this: HTMLInputElement) {
        const imagePlane = getImagePlane();

        if (!imagePlane) {
            return;
        }

        imagePlane.planePrimitive.keepImageAspect = this.checked;
    });
}
