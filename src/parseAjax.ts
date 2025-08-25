import { AssetInfo, ConstruktedTransformEditors, RawAssetInfo } from "./types/common";

export function parseGeolocaton(json: string) {
    // json should be valid

    const assetGeoLocation = JSON.parse(json);

    assetGeoLocation.longitude = parseFloat(assetGeoLocation.longitude);
    assetGeoLocation.latitude = parseFloat(assetGeoLocation.latitude);
    assetGeoLocation.height = parseFloat(assetGeoLocation.height);
    assetGeoLocation.heading = parseFloat(assetGeoLocation.heading);
    assetGeoLocation.pitch = parseFloat(assetGeoLocation.pitch);
    assetGeoLocation.roll = parseFloat(assetGeoLocation.roll);

    return assetGeoLocation;
}

export function parseAssetInfo(rawAssetInfo: RawAssetInfo) {
    const parsedMasterAssetInfo = { ...rawAssetInfo } as unknown as AssetInfo;

    if (rawAssetInfo.asset_geo_location && rawAssetInfo.asset_geo_location !== "") {
        parsedMasterAssetInfo.asset_geo_location = parseGeolocaton(rawAssetInfo.asset_geo_location);
    } else {
        parsedMasterAssetInfo.asset_geo_location = undefined;
    }

    if (rawAssetInfo.asset_geo_location_json_by_gcp && rawAssetInfo.asset_geo_location_json_by_gcp !== "") {
        parsedMasterAssetInfo.asset_geo_location_by_gcps = parseGeolocaton(rawAssetInfo.asset_geo_location_json_by_gcp);
    } else {
        parsedMasterAssetInfo.asset_geo_location_by_gcps = undefined;
    }

    if (rawAssetInfo.asset_geo_location_json_by_pre && rawAssetInfo.asset_geo_location_json_by_pre !== "") {
        parsedMasterAssetInfo.asset_geo_location_by_pre = parseGeolocaton(rawAssetInfo.asset_geo_location_json_by_pre);
    } else {
        parsedMasterAssetInfo.asset_geo_location_by_pre = undefined;
    }

    parsedMasterAssetInfo.asset_is_underground = rawAssetInfo.asset_is_underground === "true";
    parsedMasterAssetInfo.terrain_imagery_enabled = rawAssetInfo.terrain_imagery_enabled === "true";

    if (rawAssetInfo.asset_geo_location && rawAssetInfo.terrain_imagery_enabled === "") {
        parsedMasterAssetInfo.terrain_imagery_enabled = true;
    }

    if (
        parsedMasterAssetInfo.asset_geo_location &&
        !parsedMasterAssetInfo.asset_geo_location_by_gcps &&
        !parsedMasterAssetInfo.active_editor
    ) {
        parsedMasterAssetInfo.active_editor = ConstruktedTransformEditors.VisualPositionEditor;
    }

    if (
        !parsedMasterAssetInfo.asset_geo_location &&
        parsedMasterAssetInfo.asset_geo_location_by_gcps &&
        !parsedMasterAssetInfo.active_editor
    ) {
        parsedMasterAssetInfo.active_editor = ConstruktedTransformEditors.MultiGCPsEditor;
    }

    if (!parsedMasterAssetInfo.active_editor) {
        parsedMasterAssetInfo.active_editor = ConstruktedTransformEditors.VisualPositionEditor;
    }

    if (
        rawAssetInfo.new_style_url === "" ||
        rawAssetInfo.new_style_url === "false" ||
        rawAssetInfo.new_style_url === undefined
    ) {
        parsedMasterAssetInfo.new_style_url = false;
    } else {
        parsedMasterAssetInfo.new_style_url = Boolean(rawAssetInfo.new_style_url);
    }

    return parsedMasterAssetInfo;
}
