import { Cartographic, Math as CesiumMath, Rectangle } from "cesium";
import { AssetGeoLocation, ConstruktedTransformEditors } from "./types/common";
import AssetDetail from "./AssetDetails";
import ProjectDetails from "./ProjectDetails";

export default function initInfoPopup() {
    const construkted = window.Construkted;
    const editAssetDetailsBtn = $(".asset-details-editor-trigger");
    const editProjectDetailsBtn = $(".project-details-editor-trigger");
    const assetDetail = new AssetDetail();
    const projectDetail = new ProjectDetails();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("open") === "details") {
        const currentPath = window.location.pathname;
        if (currentPath.includes("/asset/")) {
            editAssetDetailsBtn.trigger("click");
        } else if (currentPath.includes("/project/")) {
            editProjectDetailsBtn.trigger("click");
        }
    }
    if (construkted.isOrthomosaic()) {
        construkted.orthomoisaicViewer.orthomosaicAdded.addEventListener(() => {
            const rectangle = construkted.orthomoisaicViewer.asset.rectangle;
            const center = Rectangle.center(rectangle);

            const digit = 8;

            const longitude = CesiumMath.toDegrees(center.longitude).toFixed(digit);
            const latitude = CesiumMath.toDegrees(center.latitude).toFixed(digit);

            const jqAssetMetadataGeolocation = window.jQuery("#asset-metadata-geolocation");

            jqAssetMetadataGeolocation.html(`Latitude: &nbsp;&nbsp; ${latitude} <br/> Longitude: &nbsp;${longitude}`);
        });

        return;
    }

    if (construkted.isTilesetAsset()) {
        const masterAsset = construkted.assetViewer.masterAsset;

        let displayed = false;

        const displayGeolocation = (geolocation: AssetGeoLocation) => {
            const jqAssetMetadataGeolocation = window.jQuery("#asset-metadata-geolocation");

            const digit = 8;
            jqAssetMetadataGeolocation.html(
                `Latitude : &nbsp;&nbsp; ${geolocation?.latitude.toFixed(
                    digit
                )} <br/> Longitude: &nbsp;${geolocation?.longitude.toFixed(
                    digit
                )} <br/> Elevation : &nbsp;&nbsp;${geolocation?.height.toFixed(3)} `
            );

            displayed = true;
        };

        masterAsset.readyEvt.addEventListener(() => {
            if (masterAsset?.originallyGeoreferencedAtECEF && !displayed) {
                displayGeolocation(masterAsset.originalGeolocation());
            }
        });

        const jqAssetMetadataGeolocationContainer = jQuery("#asset-metadata-geolocation-container");

        const setVisibilityGeolocation = () => {
            if (window.CONSTRUKTED_AJAX.active_editor === ConstruktedTransformEditors.VisualPositionEditor) {
                if (window.CONSTRUKTED_AJAX.terrain_imagery_enabled) {
                    jqAssetMetadataGeolocationContainer.show();
                } else {
                    jqAssetMetadataGeolocationContainer.hide();
                }
            } else {
                jqAssetMetadataGeolocationContainer.show();
            }
        };

        const updateGeolocation = () => {
            setVisibilityGeolocation();

            const geolocation = masterAsset.calculateGeolocation();

            if (masterAsset.hasValidGeoRef()) {
                const carto = Cartographic.fromCartesian(masterAsset.geoRef);
                geolocation.height = carto.height;
            }

            displayGeolocation(geolocation);
        };

        masterAsset.geolocationChanged.addEventListener(() => {
            updateGeolocation();
        });

        masterAsset.geoRefChanged.addEventListener(() => {
            updateGeolocation();
        });
        editAssetDetailsBtn.on("click", () => {
            const editor = $("#construkted-popup-asset-editor");
            editor.addClass("is-shown").show();
            assetDetail.init();
        });
        editProjectDetailsBtn.on("click", () => {
            const editor = $("#construkted-popup-project-editor");
            editor.addClass("is-shown").show();
            projectDetail.init();
        });
        setVisibilityGeolocation();
    }
}
