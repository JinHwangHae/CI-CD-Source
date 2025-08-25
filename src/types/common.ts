import { Cartesian3, Cesium3DTileset, Entity } from "cesium";
import { AngleUnits, AreaUnits, DistanceUnits, VolumeUnits } from "../core";

export enum ConstruktedAjaxType {
    AssetExplorerV2 = "AssetExplorerV2",
    AssetViewer = "AssetViewer"
}

export enum ConstruktedAssetType {
    Unknown = "Unknown",
    PolygonMesh = "polygon-mesh",
    ThreeDTiles = "3d-tile",
    PointCloud = "point-cloud",
    Orthomosaic = "Orthomosaic"
}

export enum ConstruktedTransformEditors {
    PredefinedGeoreference = "PredefinedGeoreference",
    VisualPositionEditor = "VisualPositionEditor",
    MultiGCPsEditor = "MultiGCPsEditor"
}

export interface AssetGeoLocation {
    longitude: number; // in degree
    latitude: number; // in degree
    height: number; // in meter
    localGeoRefX?: number; // in meter
    localGeoRefY?: number; // in meter
    localGeoRefZ?: number; // in meter
    heading: number; // in degree
    pitch: number; // in degree
    roll: number; // in degree
    scale: {
        x: number;
        y: number;
        z: number;
    };
}

export interface GCPData {
    altitudeOffset: number;
    points: any[];
    textFields: any[];
}
export interface RawAssetInfo {
    asset_geo_location: string; // json
    asset_geo_location_json_by_gcp: string; // determined by gcps editor
    asset_geo_location_json_by_pre: string; // json
    asset_is_underground: string; // boolean
    asset_server: string; // "https://s3.us-east-2.wasabisys.com
    image: string; //
    post_id: string; // int
    post_slug: string; // "agbgr2kghgm"
    post_title: string;
    terrain_imagery_enabled: string;
    active_editor: string; // "", or "Visual Position Editor" or "GCPs Editor"
    new_style_url: string | undefined;
}

export interface AssetInfo {
    asset_type: ConstruktedAssetType;
    asset_geo_location: AssetGeoLocation | undefined;
    asset_geo_location_by_gcps: AssetGeoLocation | undefined;
    asset_geo_location_by_pre: AssetGeoLocation | undefined;
    asset_is_underground: boolean;
    asset_server: string;
    image: string;
    post_id: string;
    post_slug: string;
    post_title: string;
    terrain_imagery_enabled: boolean;
    active_editor: string;
    date_capture: string | undefined;
    new_style_url: boolean;
}

export interface RelativeCameraPositionOrientation {
    offsetX: number; // relative value to center of bounding sphere of tileset
    offsetY: number; // relative value to center of bounding sphere of tileset
    offsetZ: number; // relative value to center of bounding sphere of tileset
    heading: number; // in degree
    pitch: number; // in degree
    roll: number; // in degree
    view_mode?: "orthographic" | "perspective";
    field_of_view?: number;
}

export interface CameraPositionOrientation {
    longitude: number; // in degree
    latitude: number; // in degree
    height: number; // in meter
    heading: number; // in degree
    pitch: number; // in degree
    roll: number; // in degree
    view_mode?: "orthographic" | "perspective";
    field_of_view?: number;
}

export interface RawGlobeAssetInfo {
    ID: number; // example 2167
    asset_geo_location: string; // json
    asset_is_underground: string;
    author: string; // example "1"
    date: string; // example "2020-03-30"
    image: string; // example https://gw4.construkted.com/wp-content/uploads/2020/03/thumbnail_azchwu7wg3-160x120.jpg
    post_slug: string;
    post_title: string;
    type: string; // example "polygon-mesh"
    new_style_url: string | undefined;
}

export interface ParsedGlobeAssetInfo {
    ID: number;
    asset_geo_location: AssetGeoLocation | undefined;
    asset_is_underground: boolean;
    author: number;
    date: string; // example "2020-03-30"
    image: string; // example https://gw4.construkted.com/wp-content/uploads/2020/03/thumbnail_azchwu7wg3-160x120.jpg
    post_slug: string;
    post_title: string;
    type: string; // example "polygon-mesh"
    position: Cartesian3; // will be determined from asset_geo_location
    tileset: Cesium3DTileset | undefined; // loaded tileset
    entity: Entity | undefined; // for label
    undergroundPolylineEntity: Entity | undefined;
    adjustEntityPosition: boolean; // indicate if entity 's position is adjusted
    newStyleUrl: boolean;
    exists: boolean;
    loading: boolean;
}
export interface ConstruktedAjax {
    ajax_type: ConstruktedAjaxType;
    embed: boolean; // embeded view?
    cesium_access_token: string;
    ajaxurl: string; // https://gw4.construkted.com/wp-admin/admin-ajax.php
    post_id: string; // "4972"
    post_slug: string; // amy16tpag5z
    default_camera_position_direction: string;

    active_editor: string; // "", or "Visual Position Editor" or "GCPs Editor"
    asset_geo_location: string; // determined by visual position editor
    asset_geo_location_by_pre: string; // determined by Pre-Defined Geo-Reference
    asset_geo_location_by_gcps: string; // determined by gcps editor
    terrain_imagery_enabled: string;

    is_owner: string;
    bg_color_css_string: string;
    asset_is_underground: string;
    ignore_original_transform: string;
    globe_display_status: string;
    homeurl: string; // https://gw4.construkted.com
    gcp: string;
    assets_server: string;

    // for globe page
    assets: RawGlobeAssetInfo[] | undefined;
    asset_type: string | undefined;
    depth_test_against_terrain: string | undefined;
    new_style_url: string | undefined;
    length_unit: string;
    area_unit: string;
    volume_unit: string;
    angle_unit: string;
    epsg_info: string;

    current_user?: {
        ID: number;
        has_access: string;
        is_author: string;
        logged: string;
        name: string;
        post_type: "page";
    };

    originally_georeferenced: string;
}

export interface ParsedConstruktedAjax {
    is_embed: any;
    ajax_type: ConstruktedAjaxType;
    embed: boolean; // embeded view?
    cesium_access_token: string;
    ajaxurl: string; // https://gw4.construkted.com/wp-admin/admin-ajax.php
    post_id: string; // "4972"
    post_slug: string; // amy16tpag5z
    default_camera_position_direction: RelativeCameraPositionOrientation | CameraPositionOrientation | undefined;
    active_editor: string;
    asset_geo_location: AssetGeoLocation | undefined;
    asset_geo_location_by_pre: AssetGeoLocation | undefined;
    asset_geo_location_by_gcps: AssetGeoLocation | undefined;
    terrain_imagery_enabled: boolean;
    is_owner: boolean;
    bg_color_css_string: string;
    asset_is_underground: boolean;
    ignore_original_transform: boolean;
    assets: any[]; // available for only Asset Explorer
    globe_display_status: string;
    homeurl: string; // https://gw4.construkted.com
    gcp: GCPData | undefined;
    assets_server: string;
    asset_type: ConstruktedAssetType;
    depth_test_against_terrain: boolean;
    new_style_url: boolean;
    length_unit: DistanceUnits;
    area_unit: AreaUnits;
    volume_unit: VolumeUnits;
    angle_unit: AngleUnits;
    epsg_info: string;

    current_user?: {
        ID: number;
        has_access: string;
        is_author: string;
        logged: string;
        name: string;
        post_type: "page";
    };

    originally_georeferenced: boolean;
}

export type AjaxResponse = {
    status: number;
    msg: string;
    data: string;
};

export type Annotation = {
    attachments: {
        id: number;
        name: string;
        type: string;
        url: string;
    }[];
    author: {
        id: number;
        name: string;
    };
    color: string;
    category?: string;
    comments: string;
    date: string;
    description: string;
    details: string; // json string
    entity_id: string;
    image:
        | boolean // if not set, it would be false
        | {
              id: number;
              url: string;
          };
    image_plane_image: string;
    linewidth: string;
    clamp_to_ground: string; // "true" or "false"
    post_id: number;
    show_note_pin: string; // y or n
    show_note_text: string; // y or n
    show_note_leader: string; // y or n
    title: string;
    type: string;
    view:
        | boolean // view is not set, it would be false
        | {
              offsetX: number;
              offsetY: number;
              offsetZ: number;
              heading: number; // in degree
              pitch: number; // in degree
              roll: number; // in degree
          };
    asset: string; // post id
    capture: string; // ex 'data:image/jpeg;base64,/9j/4AAQSkZ"
};
