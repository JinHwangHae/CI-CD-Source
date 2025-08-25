import * as Cesium from "cesium";
import { ParsedConstruktedAjax } from "./types/common";
import { saveCurrentView, saveDefaultViewpointId } from "./construkted_ajax";
import "./css/camera-viewpoints.css";

interface FormElements {
    viewpointName: HTMLInputElement;
    viewpointDescription: HTMLTextAreaElement;
    savePosition: HTMLInputElement;
    saveRotation: HTMLInputElement;
    transitionType: HTMLInputElement;
    transitionDuration: HTMLInputElement;
    viewpointId: HTMLInputElement;
    postId: HTMLInputElement;
}

interface FormDataType {
    action: string;
    post_id: string;
    viewpoint_id: string;
    viewpoint_name: string;
    viewpoint_description: string;
    save_position: boolean;
    save_rotation: boolean;
    transition_type: string;
    transition_duration: number;
    camera_data?: {
        position?: { x: number; y: number; z: number };
        rotation?: { x: number; y: number; z: number };
        view_mode?: "perspective" | "orthographic";
        field_of_view?: number;
    };
}
class CameraViewpoints {
    private _CONSTRUKTED_AJAX: ParsedConstruktedAjax;
    private _viewer: any; // Replace 'any' with your actual viewer type
    private _cameraChangeListener: (() => void) | null;
    private _saveButton: HTMLButtonElement | null;
    private _defaultViewpointId: string | null;

    constructor(viewer: any) {
        this._CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;
        this._viewer = viewer;
        this._cameraChangeListener = null;
        this._saveButton = null;
        this._defaultViewpointId = null;
        this.init();
    }

    // Optimized AJAX helper functions
    private async _makeAjaxRequest(action: string, additionalData: any = {}): Promise<any> {
        const postId = (document.querySelector('input[name="post_id"]') as HTMLInputElement).value;

        return new Promise((resolve, reject) => {
            window.jQuery.ajax({
                url: this._CONSTRUKTED_AJAX.ajaxurl,
                type: "POST",
                data: {
                    action: action,
                    post_id: postId,
                    ...additionalData
                },
                success: (response: any) => resolve(response),
                error: (error: any) => reject(error)
            });
        });
    }

    private async _getDefaultViewpointId(): Promise<string | null> {
        try {
            const response = await this._makeAjaxRequest("get_default_viewpoint_id");
            if (response.success && response.data && response.data.viewpoint_id) {
                return response.data.viewpoint_id;
            }
        } catch (error) {
            console.error("Error fetching default viewpoint ID:", error);
        }
        return null;
    }

    private async _makeAjaxRequestWithLoader(action: string, additionalData: any = {}): Promise<any> {
        // Show loading indicator
        window.jQuery(".ck-processing-loader").addClass("shown");

        try {
            const response = await this._makeAjaxRequest(action, additionalData);
            // Hide loading indicator
            window.jQuery(".ck-processing-loader").removeClass("shown");
            return response;
        } catch (error) {
            // Hide loading indicator
            window.jQuery(".ck-processing-loader").removeClass("shown");
            throw error;
        }
    }

    private async _getCameraViewpoint(viewpointId: string): Promise<any> {
        return this._makeAjaxRequestWithLoader("get_camera_viewpoint", { viewpoint_id: viewpointId });
    }

    private async _getCameraViewpoints(): Promise<any> {
        return this._makeAjaxRequestWithLoader("get_camera_viewpoints");
    }

    private async _saveCameraViewpoint(formData: FormDataType): Promise<any> {
        return this._makeAjaxRequestWithLoader("save_camera_viewpoint", formData);
    }

    private async _deleteCameraViewpoint(viewpointId: string): Promise<any> {
        return this._makeAjaxRequestWithLoader("delete_camera_viewpoint", { viewpoint_id: viewpointId });
    }

    init() {
        // Check if user is logged in
        const isLoggedIn =
            window.CONSTRUKTED_AJAX?.current_user?.logged === "true" || window.currentUser?.logged === "true";

        // Hide the [+] button if user is not logged in
        const addButton = document.querySelector(".camera-viewpoints-trigger") as HTMLElement;
        if (addButton && !isLoggedIn) {
            addButton.style.display = "none";
        }

        this._saveButton = document.querySelector(".save-viewpoint") as HTMLButtonElement;
        this.bindEvents();
        CameraViewpoints.setupTransitionTypeToggle();
        this._setupCameraInputEvents();
        this._setupCameraChangeListener();
        this._setupCameraViewModeEvents();
        this._setupCameraFieldOfViewEvents();
    }

    private _setupCameraViewModeEvents(): void {
        const cameraSwitcher = document.querySelector("#camera-switcher") as HTMLInputElement;
        const cameraFieldOfViewContainer = document.querySelector("#camera-field-of-view-container") as HTMLElement;

        if (cameraSwitcher) {
            cameraSwitcher.addEventListener("change", () => {
                if (cameraSwitcher.checked) {
                    this._viewer.scene.camera.switchToOrthographicFrustum();
                    if (cameraFieldOfViewContainer) {
                        cameraFieldOfViewContainer.style.display = "none";
                    }
                } else {
                    this._viewer.scene.camera.switchToPerspectiveFrustum();
                    if (cameraFieldOfViewContainer) {
                        cameraFieldOfViewContainer.style.display = "block";
                    }
                }
            });
        }
    }

    private _setupCameraFieldOfViewEvents(): void {
        const rangeInput = document.querySelector("#camera-field-of-view-range-input") as HTMLInputElement;
        const numberInput = document.querySelector("#camera-field-of-view-input") as HTMLInputElement;
        const resetButton = document.querySelector("#reset-camera-field-of-view") as HTMLElement;

        // Set initial values
        const initialFov = this._viewer.scene.camera.frustum.fov;
        const fovDegrees = Cesium.Math.toDegrees(initialFov);

        if (rangeInput && numberInput) {
            rangeInput.value = fovDegrees.toString();
            numberInput.value = fovDegrees.toString();
        }

        // Handle range input changes
        if (rangeInput) {
            rangeInput.addEventListener("input", () => {
                const fov = parseFloat(rangeInput.value);
                if (numberInput) {
                    numberInput.value = fov.toString();
                }
                this._updateCameraFov(fov);
            });
        }

        // Handle number input changes
        if (numberInput) {
            numberInput.addEventListener("input", () => {
                const fov = parseFloat(numberInput.value);
                if (!Number.isNaN(fov) && fov >= 1 && fov <= 120) {
                    if (rangeInput) {
                        rangeInput.value = fov.toString();
                    }
                    this._updateCameraFov(fov);
                }
            });
        }

        // Handle reset button
        if (resetButton) {
            resetButton.addEventListener("click", () => {
                const defaultFov = 60; // Default FOV in degrees
                if (rangeInput && numberInput) {
                    rangeInput.value = defaultFov.toString();
                    numberInput.value = defaultFov.toString();
                }
                this._updateCameraFov(defaultFov);
            });
        }
    }

    private _updateCameraFov(fovDegrees: number): void {
        const camera = this._viewer.scene.camera;
        if (camera.frustum.fov !== undefined) {
            camera.frustum.fov = Cesium.Math.toRadians(fovDegrees);
            this._viewer.scene.requestRender();
        }
    }

    private _updateSaveButtonText(text: string): void {
        if (this._saveButton) {
            this._saveButton.innerHTML = `<i class="icon-tick"></i> ${text}`;
        }
    }

    private _setupCameraChangeListener(): void {
        // Remove any existing listener
        if (this._cameraChangeListener) {
            this._viewer.camera.changed.removeEventListener(this._cameraChangeListener);
        }

        // Create new listener
        this._cameraChangeListener = () => {
            const editor = window.jQuery("#construkted-popup-camera-viewpoints");
            if (!editor.is(":visible")) return; // Only update if editor is visible

            const camera = this._viewer.camera;
            const position = camera.position;
            const cartographic = this._viewer.scene.globe.ellipsoid.cartesianToCartographic(position);

            // Update position inputs
            const positionInputs = Array.from(
                document.querySelectorAll('.camera-input[data-type="position"]')
            ) as HTMLInputElement[];
            if (positionInputs.length >= 3) {
                positionInputs[0].value = Cesium.Math.toDegrees(cartographic.longitude).toFixed(8);
                positionInputs[1].value = Cesium.Math.toDegrees(cartographic.latitude).toFixed(8);
                positionInputs[2].value = cartographic.height.toFixed(3);
            }

            // Update rotation inputs
            const rotationInputs = Array.from(
                document.querySelectorAll('.camera-input[data-type="rotation"]')
            ) as HTMLInputElement[];
            if (rotationInputs.length >= 3) {
                rotationInputs[0].value = Cesium.Math.toDegrees(camera.pitch).toFixed(1);
                rotationInputs[1].value = Cesium.Math.toDegrees(camera.heading).toFixed(1);
                rotationInputs[2].value = Cesium.Math.toDegrees(camera.roll).toFixed(1);
            }
        };

        // Add the listener to camera changed event
        this._viewer.camera.changed.addEventListener(this._cameraChangeListener);
    }

    private _setupCameraInputEvents(): void {
        // Get all input elements
        const positionInputs = Array.from(
            document.querySelectorAll('.camera-input[data-type="position"]')
        ) as HTMLInputElement[];
        const rotationInputs = Array.from(
            document.querySelectorAll('.camera-input[data-type="rotation"]')
        ) as HTMLInputElement[];

        if (!positionInputs.length || !rotationInputs.length) {
            console.warn("Some camera input elements were not found");
            return;
        }

        // Helper function to update camera position
        const updateCameraPosition = () => {
            const camera = this._viewer.camera;
            const x = parseFloat(positionInputs[0]?.value || "0"); // longitude
            const y = parseFloat(positionInputs[1]?.value || "0"); // latitude
            const z = parseFloat(positionInputs[2]?.value || "0"); // height

            if (!Number.isNaN(x) && !Number.isNaN(y) && !Number.isNaN(z)) {
                const cartographic = new Cesium.Cartographic(Cesium.Math.toRadians(x), Cesium.Math.toRadians(y), z);

                // Temporarily remove the camera change listener to prevent feedback loop
                const tempListener = this._cameraChangeListener;
                if (tempListener) {
                    this._viewer.camera.changed.removeEventListener(tempListener);
                }

                // Get the current camera heading, pitch, and roll
                const currentHeading = camera.heading;
                const currentPitch = camera.pitch;
                const currentRoll = camera.roll;

                // Convert cartographic to Cartesian3
                const destination = this._viewer.scene.globe.ellipsoid.cartographicToCartesian(cartographic);

                // Use flyTo for smooth transition, maintaining orientation
                camera.flyTo({
                    destination: destination,
                    orientation: {
                        heading: currentHeading,
                        pitch: currentPitch,
                        roll: currentRoll
                    },
                    duration: 0.1,
                    complete: () => {
                        // Restore the camera change listener
                        if (tempListener) {
                            this._viewer.camera.changed.addEventListener(tempListener);
                        }
                        this._viewer.scene.requestRender();
                    }
                });
            }
        };

        // Helper function to update camera rotation
        const updateCameraRotation = () => {
            const camera = this._viewer.camera;
            const pitch = parseFloat(rotationInputs[0]?.value || "0");
            const heading = parseFloat(rotationInputs[1]?.value || "0");
            const roll = parseFloat(rotationInputs[2]?.value || "0");

            if (!Number.isNaN(pitch) && !Number.isNaN(heading) && !Number.isNaN(roll)) {
                // Keep current position but update orientation
                const currentPosition = camera.position.clone();

                // Temporarily remove the camera change listener to prevent feedback loop
                const tempListener = this._cameraChangeListener;
                if (tempListener) {
                    this._viewer.camera.changed.removeEventListener(tempListener);
                }

                camera.flyTo({
                    destination: currentPosition,
                    orientation: {
                        heading: Cesium.Math.toRadians(heading),
                        pitch: Cesium.Math.toRadians(pitch),
                        roll: Cesium.Math.toRadians(roll)
                    },
                    duration: 0.1,
                    complete: () => {
                        // Restore the camera change listener
                        if (tempListener) {
                            this._viewer.camera.changed.addEventListener(tempListener);
                        }
                        this._viewer.scene.requestRender();
                    }
                });
            }
        };

        // Add input event listeners
        positionInputs.forEach((input) => {
            input?.addEventListener("input", () => {
                updateCameraPosition();
            });
        });

        rotationInputs.forEach((input) => {
            input?.addEventListener("input", () => {
                updateCameraRotation();
            });
        });
    }

    bindEvents() {
        const jQuery = window.jQuery;
        // Remove existing handlers
        jQuery(document).off("click", ".camera-viewpoints-trigger");
        jQuery(document).off("click", "#construkted-popup-camera-viewpoints .close-popup");
        jQuery(document).off("click", "#construkted-popup-camera-viewpoints .save-viewpoint");
        jQuery(document).off("click", ".viewpoint-item .menu-item[data-action='edit']");
        jQuery(document).off("click", ".viewpoint-item .menu-item[data-action='delete']");
        jQuery(document).off("click", ".viewpoint-item .star-viewpoint-btn");
        jQuery(document).off("click", ".viewpoint-item .cameraviewpoint-dropdown-toggle");
        jQuery(document).off("click", "#change-viewpoint-btn .change-view");
        jQuery(document).off("click", ".viewpoint-item .node-title");

        // Add new handlers
        jQuery(document).on("click", ".camera-viewpoints-trigger", jQuery.proxy(this.handleQuickAddViewpoint, this));
        jQuery(document).on(
            "click",
            "#construkted-popup-camera-viewpoints .close-popup",
            jQuery.proxy(this.hideViewpointsEditor, this)
        );
        jQuery(document).on(
            "click",
            "#construkted-popup-camera-viewpoints .save-viewpoint",
            jQuery.proxy(this.handleSaveViewpoint, this)
        );
        jQuery(document).on(
            "click",
            ".viewpoint-item .menu-item[data-action='edit']",
            jQuery.proxy(this.handleEditViewpoint, this)
        );
        jQuery(document).on(
            "click",
            ".viewpoint-item .menu-item[data-action='delete']",
            jQuery.proxy(this.handleDeleteViewpoint, this)
        );
        jQuery(document).on(
            "click",
            ".viewpoint-item .star-viewpoint-btn",
            jQuery.proxy(this.handleMakeDefaultViewpoint, this)
        );
        jQuery(document).on(
            "click",
            ".viewpoint-item .cameraviewpoint-dropdown-toggle",
            CameraViewpoints._handleMenuToggle
        );
        jQuery(document).on(
            "click",
            "#change-viewpoint-btn .change-view",
            jQuery.proxy(this.handleChangeViewpoint, this)
        );
        jQuery(document).on("click", ".viewpoint-item .node-title", jQuery.proxy(this.handleZoomToViewpoint, this));

        // Close dropdown when clicking outside
        jQuery(document).on("click", (e: Event) => {
            if (!jQuery(e.target as Element).closest(".cameraviewpoint-dropdown-menu").length) {
                jQuery(".cameraviewpoint-dropdown-menu").addClass("hidden");
            }
        });
    }

    private static _handleMenuToggle(e: Event): void {
        e.preventDefault();
        e.stopPropagation();

        const button = e.target as HTMLElement;
        const dropdownToggle = button.closest(".cameraviewpoint-dropdown-toggle") as HTMLElement;
        const dropdown = dropdownToggle.nextElementSibling as HTMLElement;
        // Close all other dropdowns first
        window.jQuery(".cameraviewpoint-dropdown-menu").addClass("hidden");

        // Toggle current dropdown - be explicit about removing the hidden class
        if (dropdown.classList.contains("hidden")) {
            dropdown.classList.remove("hidden");
        } else {
            dropdown.classList.add("hidden");
        }
    }

    handleZoomToViewpoint(e: Event): void {
        e.preventDefault();
        const button = e.target as HTMLElement;
        const viewpointItem = button.closest(".viewpoint-item");
        if (!viewpointItem) return;

        const viewpointId = viewpointItem.getAttribute("data-id");
        if (!viewpointId) return;

        const postId = (document.querySelector('input[name="post_id"]') as HTMLInputElement).value;

        // Show loading indicator
        window.jQuery(".ck-processing-loader").addClass("shown");

        // Fetch viewpoint data and fly to it
        window.jQuery.ajax({
            url: this._CONSTRUKTED_AJAX.ajaxurl,
            type: "POST",
            data: {
                action: "get_camera_viewpoint",
                post_id: postId,
                viewpoint_id: viewpointId
            },
            success: (response: any) => {
                if (response.success) {
                    this._flyToViewpoint(response.data.viewpoint);
                }
                // Hide loading indicator
                window.jQuery(".ck-processing-loader").removeClass("shown");
            },
            error: (error: any) => {
                console.error("Error fetching viewpoint data:", error);
                alert("Error loading viewpoint data. Please try again.");
                // Hide loading indicator
                window.jQuery(".ck-processing-loader").removeClass("shown");
            }
        });
    }

    async handleQuickAddViewpoint(e: Event): Promise<void> {
        e.preventDefault();
        e.stopPropagation();

        // Get current camera data
        const cameraData = this._getCurrentCameraData();

        // Create form data for quick add
        const formData: FormDataType = {
            action: "save_camera_viewpoint",
            post_id: (document.querySelector('input[name="post_id"]') as HTMLInputElement).value,
            viewpoint_id: "",
            viewpoint_name: "Untitled Viewpoint",
            viewpoint_description: "",
            save_position: true,
            save_rotation: true,
            transition_type: "instant",
            transition_duration: 2.0,
            camera_data: cameraData
        };

        try {
            const response = await this._saveCameraViewpoint(formData);

            if (response.success) {
                // Refresh the viewpoints list to show the new item
                await this.refreshViewpointsList();
                alert("Viewpoint added successfully!");
            } else {
                alert("Error creating viewpoint. Please try again.");
            }
        } catch (error) {
            console.error("Error creating viewpoint:", error);
            alert("Error creating viewpoint. Please try again.");
        }
    }

    private _flyToViewpoint(viewpoint: any): void {
        const camera = this._viewer.camera;
        const cameraData = viewpoint.camera_data;

        // Set camera view mode first
        if (cameraData.view_mode) {
            const cameraSwitcher = document.querySelector("#camera-switcher") as HTMLInputElement;
            const cameraFieldOfViewContainer = document.querySelector("#camera-field-of-view-container") as HTMLElement;

            if (cameraData.view_mode === "orthographic") {
                // Switch to orthographic mode
                const width = camera.frustum.width || 100; // Keep current width or use default
                const aspectRatio = camera.frustum.aspectRatio;
                camera.frustum = new Cesium.OrthographicFrustum({
                    width: width,
                    aspectRatio: aspectRatio
                });

                if (cameraSwitcher) cameraSwitcher.checked = true;
                if (cameraFieldOfViewContainer) cameraFieldOfViewContainer.style.display = "none";
            } else {
                // Switch to perspective mode
                const fov = cameraData.field_of_view
                    ? Cesium.Math.toRadians(cameraData.field_of_view)
                    : Cesium.Math.toRadians(60);
                const aspectRatio = camera.frustum.aspectRatio;
                camera.frustum = new Cesium.PerspectiveFrustum({
                    fov: fov,
                    aspectRatio: aspectRatio
                });

                if (cameraSwitcher) cameraSwitcher.checked = false;
                if (cameraFieldOfViewContainer) cameraFieldOfViewContainer.style.display = "block";

                // Update FOV inputs
                const rangeInput = document.querySelector("#camera-field-of-view-range-input") as HTMLInputElement;
                const numberInput = document.querySelector("#camera-field-of-view-input") as HTMLInputElement;
                if (rangeInput) rangeInput.value = cameraData.field_of_view?.toString() || "60";
                if (numberInput) numberInput.value = cameraData.field_of_view?.toString() || "60";
            }

            // Request a render to update the view
            this._viewer.scene.requestRender();
        }

        if (cameraData.position) {
            const position = cameraData.position;
            const cartographic = new Cesium.Cartographic(
                Cesium.Math.toRadians(position.x),
                Cesium.Math.toRadians(position.y),
                position.z
            );
            const destination = this._viewer.scene.globe.ellipsoid.cartographicToCartesian(cartographic);

            const orientation: any = {};

            if (cameraData.rotation) {
                const rotation = cameraData.rotation;
                orientation.heading = Cesium.Math.toRadians(rotation.y);
                orientation.pitch = Cesium.Math.toRadians(rotation.x);
                orientation.roll = Cesium.Math.toRadians(rotation.z);
            }

            const flyToOptions: any = {
                destination: destination,
                duration: viewpoint.transition_duration || 2.0
            };

            if (Object.keys(orientation).length > 0) {
                flyToOptions.orientation = orientation;
            }

            camera.flyTo(flyToOptions);
        }
    }

    static setupTransitionTypeToggle(): void {
        const jQuery = window.jQuery;
        jQuery('input[name="transition-type"]').on("change", function (this: HTMLInputElement) {
            const durationGroup = jQuery("#transition-duration-group");
            if (jQuery(this).val() === "smooth") {
                durationGroup.show();
            } else {
                durationGroup.hide();
            }
        });
    }

    showViewpointsEditor(): void {
        const editor = window.jQuery("#construkted-popup-camera-viewpoints");
        if (editor.length === 0) {
            return;
        }

        // Capture current view and update featured image
        const viewer = this._viewer;
        const camera = viewer.camera;

        // Get current camera values
        const position = camera.position;
        const cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(position);

        // Update position inputs
        const positionInputs = Array.from(
            document.querySelectorAll('.camera-input[data-type="position"]')
        ) as HTMLInputElement[];
        positionInputs[0].value = Cesium.Math.toDegrees(cartographic.longitude).toFixed(8);
        positionInputs[1].value = Cesium.Math.toDegrees(cartographic.latitude).toFixed(8);
        positionInputs[2].value = cartographic.height.toFixed(3);

        // Update rotation inputs
        const rotationInputs = Array.from(
            document.querySelectorAll('.camera-input[data-type="rotation"]')
        ) as HTMLInputElement[];
        rotationInputs[0].value = Cesium.Math.toDegrees(camera.pitch).toFixed(1);
        rotationInputs[1].value = Cesium.Math.toDegrees(camera.heading).toFixed(1);
        rotationInputs[2].value = Cesium.Math.toDegrees(camera.roll).toFixed(1);

        viewer.scene.requestRender();
        viewer.render();
        const mediumQuality = viewer.canvas.toDataURL("image/jpeg", 0.5);

        // Update the featured image
        const featuredImage = window.jQuery("#capture-cameraviewpoint-image");
        if (featuredImage.length > 0 && featuredImage.find("img").length > 0) {
            featuredImage.find("img").attr("src", mediumQuality);
        } else {
            window
                .jQuery(".camera-viewpoints-trigger")
                .before(`<div id="capture-cameraviewpoint-image"><img src="${mediumQuality}" /></div>`);
        }

        editor.show();

        // Reset form and ensure button text is correct for create mode
        const form = document.getElementById("camera-viewpoint-form") as HTMLFormElement;
        if (form) {
            form.reset();
            (document.querySelector('input[name="viewpoint_id"]') as HTMLInputElement).value = "";

            // Set button text to Create Viewpoint for new viewpoints
            this._updateSaveButtonText("Create Viewpoint");
        }

        // Load viewpoints list
        this.refreshViewpointsList();

        // Ensure camera change listener is set up
        this._setupCameraChangeListener();
    }

    hideViewpointsEditor(): void {
        const editor = window.jQuery("#construkted-popup-camera-viewpoints");
        editor.hide();

        // Clean up camera change listener
        if (this._cameraChangeListener) {
            this._viewer.camera.changed.removeEventListener(this._cameraChangeListener);
            this._cameraChangeListener = null;
        }

        // Reset form and button text when closing
        const form = document.getElementById("camera-viewpoint-form") as HTMLFormElement;
        if (form) {
            form.reset();
            (document.querySelector('input[name="viewpoint_id"]') as HTMLInputElement).value = "";

            // Reset save button text
            this._updateSaveButtonText("Create Viewpoint");
        }

        // Reset trigger button text
        const triggerButton = document.querySelector(".camera-viewpoints-trigger");
        if (triggerButton) {
            triggerButton.innerHTML = '<i class="gwicon-camera"></i> Create Camera Viewpoints';
        }

        this._viewer.scene.requestRender();
    }

    private _getCurrentCameraData() {
        const camera = this._viewer.camera;
        const position = camera.position;
        const cartographic = this._viewer.scene.globe.ellipsoid.cartesianToCartographic(position);

        // Get camera view mode
        const isOrthographic = camera.frustum.constructor.name === "OrthographicFrustum";

        // Get field of view (only applicable in perspective mode)
        const fov = isOrthographic ? undefined : Cesium.Math.toDegrees(camera.frustum.fov);

        return {
            position: {
                x: Cesium.Math.toDegrees(cartographic.longitude),
                y: Cesium.Math.toDegrees(cartographic.latitude),
                z: cartographic.height
            },
            rotation: {
                x: Cesium.Math.toDegrees(camera.pitch),
                y: Cesium.Math.toDegrees(camera.heading),
                z: Cesium.Math.toDegrees(camera.roll)
            },
            view_mode: (isOrthographic ? "orthographic" : "perspective") as "orthographic" | "perspective",
            field_of_view: fov
        };
    }

    private static _getFormElements(): FormElements {
        const form = document.getElementById("camera-viewpoint-form") as HTMLFormElement;
        return {
            viewpointName: form.querySelector<HTMLInputElement>("#viewpoint-name")!,
            viewpointDescription: form.querySelector<HTMLTextAreaElement>("#viewpoint-description")!,
            savePosition: form.querySelector<HTMLInputElement>("#save-position")!,
            saveRotation: form.querySelector<HTMLInputElement>("#save-rotation")!,
            transitionType: form.querySelector<HTMLInputElement>('input[name="transition-type"]:checked')!,
            transitionDuration: form.querySelector<HTMLInputElement>("#transition-duration")!,
            viewpointId: form.querySelector<HTMLInputElement>('input[name="viewpoint_id"]')!,
            postId: form.querySelector<HTMLInputElement>('input[name="post_id"]')!
        };
    }

    private static _createFormData(elements: FormElements): FormDataType {
        // Get camera position values
        const positionInputs = Array.from(
            document.querySelectorAll('.camera-input[data-type="position"]')
        ) as HTMLInputElement[];
        const positionX = parseFloat(positionInputs[0].value);
        const positionY = parseFloat(positionInputs[1].value);
        const positionZ = parseFloat(positionInputs[2].value);

        // Get camera rotation values
        const rotationInputs = Array.from(
            document.querySelectorAll('.camera-input[data-type="rotation"]')
        ) as HTMLInputElement[];
        const rotationX = parseFloat(rotationInputs[0].value);
        const rotationY = parseFloat(rotationInputs[1].value);
        const rotationZ = parseFloat(rotationInputs[2].value);

        return {
            action: "save_camera_viewpoint",
            post_id: elements.postId.value,
            viewpoint_id: elements.viewpointId.value,
            viewpoint_name: elements.viewpointName.value,
            viewpoint_description: elements.viewpointDescription.value,
            save_position: !Number.isNaN(positionX) && !Number.isNaN(positionY) && !Number.isNaN(positionZ),
            save_rotation: !Number.isNaN(rotationX) && !Number.isNaN(rotationY) && !Number.isNaN(rotationZ),
            transition_type: elements.transitionType.value,
            transition_duration: parseFloat(elements.transitionDuration.value),
            camera_data: {
                position:
                    !Number.isNaN(positionX) && !Number.isNaN(positionY) && !Number.isNaN(positionZ)
                        ? {
                              x: positionX,
                              y: positionY,
                              z: positionZ
                          }
                        : undefined,
                rotation:
                    !Number.isNaN(rotationX) && !Number.isNaN(rotationY) && !Number.isNaN(rotationZ)
                        ? {
                              x: rotationX,
                              y: rotationY,
                              z: rotationZ
                          }
                        : undefined,
                // Get current camera view mode and FOV
                view_mode: (document.querySelector("#camera-switcher") as HTMLInputElement)?.checked
                    ? "orthographic"
                    : "perspective",
                field_of_view: (document.querySelector("#camera-switcher") as HTMLInputElement)?.checked
                    ? undefined
                    : parseFloat(
                          (document.querySelector("#camera-field-of-view-input") as HTMLInputElement)?.value || "60"
                      )
            }
        };
    }

    async handleSaveViewpoint(e: Event): Promise<void> {
        e.preventDefault();
        const button = e.target as HTMLButtonElement;
        if (button.disabled) {
            return;
        }
        button.disabled = true;

        // Validate required fields
        const formElements = CameraViewpoints._getFormElements();
        if (!formElements.viewpointName.value.trim()) {
            alert("Viewpoint name is required");
            formElements.viewpointName.focus();
            button.disabled = false;
            return;
        }

        // Validate camera values
        const positionInputs = Array.from(
            document.querySelectorAll('.camera-input[data-type="position"]')
        ) as HTMLInputElement[];
        const positionX = parseFloat(positionInputs[0]?.value || "0");
        const positionY = parseFloat(positionInputs[1]?.value || "0");
        const positionZ = parseFloat(positionInputs[2]?.value || "0");

        const rotationInputs = Array.from(
            document.querySelectorAll('.camera-input[data-type="rotation"]')
        ) as HTMLInputElement[];
        const rotationX = parseFloat(rotationInputs[0]?.value || "0");
        const rotationY = parseFloat(rotationInputs[1]?.value || "0");
        const rotationZ = parseFloat(rotationInputs[2]?.value || "0");
        // Check if at least one camera parameter is set
        if (
            (Number.isNaN(positionX) || Number.isNaN(positionY) || Number.isNaN(positionZ)) &&
            (Number.isNaN(rotationX) || Number.isNaN(rotationY) || Number.isNaN(rotationZ))
        ) {
            alert("At least one camera parameter (position, rotation) must be set");
            button.disabled = false;
            return;
        }

        // Create form data
        const formData = CameraViewpoints._createFormData(formElements);

        await this._submitFormData(formData, button);
    }

    private async _submitFormData(formData: FormDataType, button: HTMLButtonElement): Promise<void> {
        // Show loading indicator
        window.jQuery(".ck-processing-loader").addClass("shown");

        // Convert the form data to a format that PHP can properly handle
        const postData = {
            action: formData.action,
            post_id: formData.post_id,
            viewpoint_id: formData.viewpoint_id,
            viewpoint_name: formData.viewpoint_name,
            viewpoint_description: formData.viewpoint_description,
            save_position: formData.save_position,
            save_rotation: formData.save_rotation,
            transition_type: formData.transition_type,
            transition_duration: formData.transition_duration,
            camera_data: {
                ...formData.camera_data,
                // Ensure view_mode and field_of_view are included
                view_mode: formData.camera_data?.view_mode,
                field_of_view: formData.camera_data?.field_of_view
            }
        };

        try {
            const response = await this._saveCameraViewpoint(postData);

            if (response.success) {
                // If this is the default viewpoint, update the current view
                const viewpointId = formData.viewpoint_id;
                if (viewpointId === this._defaultViewpointId) {
                    const viewData = {
                        longitude: formData.camera_data?.position?.x || 0,
                        latitude: formData.camera_data?.position?.y || 0,
                        height: formData.camera_data?.position?.z || 0,
                        heading: formData.camera_data?.rotation?.y || 0,
                        pitch: formData.camera_data?.rotation?.x || 0,
                        roll: formData.camera_data?.rotation?.z || 0,
                        view_mode: formData.camera_data?.view_mode || "perspective",
                        field_of_view: formData.camera_data?.field_of_view
                    };
                    await saveCurrentView(JSON.stringify(viewData));
                }

                alert("Viewpoint saved successfully!");
                this.refreshViewpointsList();

                // Close the camera editor
                this.hideViewpointsEditor();
            } else {
                alert("An error occurred while saving the viewpoint. Please try again.");
            }
            button.disabled = false;
        } catch (error) {
            // Hide loading indicator
            window.jQuery(".ck-processing-loader").removeClass("shown");

            console.error("Error saving viewpoint:", error);
            button.disabled = false;
            alert("An error occurred while saving the viewpoint. Please try again.");
        }
    }

    public async refreshViewpointsList(): Promise<void> {
        // Show loading indicator
        window.jQuery(".ck-processing-loader").addClass("shown");

        try {
            // Get the default viewpoint ID first
            this._defaultViewpointId = await this._getDefaultViewpointId();

            const response = await this._getCameraViewpoints();
            // Hide loading indicator
            window.jQuery(".ck-processing-loader").removeClass("shown");

            if (response.success) {
                const viewpointsList = document.querySelector(".viewpoints-list");
                if (viewpointsList && response.data.viewpoints) {
                    viewpointsList.innerHTML = CameraViewpoints._renderViewpointsList(
                        response.data.viewpoints,
                        this._defaultViewpointId
                    );
                }
            }
        } catch (error) {
            // Hide loading indicator
            window.jQuery(".ck-processing-loader").removeClass("shown");

            console.error("Error fetching viewpoints:", error);
        }
    }

    private static _updateStarVisualState(): void {
        // This method would check if there's a current default viewpoint
        // and update the star visual state accordingly
        // For now, we'll keep all stars unfilled (gray)
        // In a real implementation, you might want to check against a stored default viewpoint ID
        const allStarButtons = document.querySelectorAll(".star-viewpoint-btn");
        allStarButtons.forEach((button) => {
            const starSpan = button.querySelector("span") as HTMLElement;
            if (starSpan) {
                starSpan.style.color = "#ccc";
                starSpan.textContent = "☆"; // Unfilled star
            }
        });
    }

    private static _renderViewpointsList(viewpoints: any[], defaultViewpointId: string | null): string {
        if (!viewpoints.length) {
            return '<p class="no-viewpoints">No viewpoints saved yet.</p>';
        }

        // Check if user is logged in
        const isLoggedIn =
            window.CONSTRUKTED_AJAX?.current_user?.logged === "true" || window.currentUser?.logged === "true";

        return viewpoints
            .map((viewpoint) => {
                const isDefault = defaultViewpointId === viewpoint.id;

                return `
                    <div class="annotation-tree-node viewpoint-item" data-id="${viewpoint.id}">
                        <div class="node-content">
                            <div class="node-controls">
                                <i class="gwicon-camera" style="color: #4a90e2; font-size: 14px;"></i>
                            </div>
                            <div class="node-info">
                                <span class="node-title" style="cursor: pointer;">${viewpoint.name}</span>
                            </div>
                            ${
                                isLoggedIn
                                    ? `
                            <div class="node-actions">
                                <button class="star-viewpoint-btn" title="Make Default Viewpoint">
                                    <span style="${
                                        isDefault ? "color: #4a90e2" : "color: #ccc"
                                    }; font-size: 18px; font-style: normal;">${isDefault ? "★" : "☆"}</span>
                                </button>
                                <button class="cameraviewpoint-dropdown-toggle" title="More options">⋮</button>
                                <div class="cameraviewpoint-dropdown-menu hidden">
                                    <button class="menu-item edit-viewpoint" data-action="edit">
                                        <i class="gwicon-edit"></i> Edit
                                    </button>
                                    <button class="menu-item delete-viewpoint" data-action="delete">
                                        <i class="icon-delete"></i> Delete
                                    </button>
                                </div>
                            </div>
                            `
                                    : ""
                            }
                        </div>
                    </div>
                `;
            })
            .join("");
    }

    async handleEditViewpoint(e: Event): Promise<void> {
        const button = e.target as HTMLElement;
        const viewpointItem = button.closest(".viewpoint-item");
        if (!viewpointItem) return;

        const viewpointId = viewpointItem.getAttribute("data-id");
        if (!viewpointId) return;
        // Fetch viewpoint data and populate form
        try {
            const response = await this._getCameraViewpoint(viewpointId);
            if (response.success) {
                this.showViewpointsEditor();
                // Then populate the form after a small delay to ensure popup is visible
                setTimeout(() => {
                    this._populateViewpointForm(response.data.viewpoint);
                }, 100);
            }
            // Hide loading indicator
            window.jQuery(".ck-processing-loader").removeClass("shown");
        } catch (error) {
            alert("Error loading viewpoint data. Please try again.");
            // Hide loading indicator
            window.jQuery(".ck-processing-loader").removeClass("shown");
        }
    }

    private _populateViewpointForm(viewpoint: any): void {
        const form = document.getElementById("camera-viewpoint-form") as HTMLFormElement;
        if (!form) {
            console.error("Camera viewpoint form not found");
            return;
        }

        // Set basic form fields with null checks
        const viewpointIdInput = form.querySelector('input[name="viewpoint_id"]') as HTMLInputElement;
        const nameInput = form.querySelector("#viewpoint-name") as HTMLInputElement;
        const descriptionInput = form.querySelector("#viewpoint-description") as HTMLTextAreaElement;

        if (viewpointIdInput) viewpointIdInput.value = viewpoint.id;
        if (nameInput) nameInput.value = viewpoint.name;
        if (descriptionInput) descriptionInput.value = viewpoint.description || "";

        // First update camera view mode and field of view
        if (viewpoint.camera_data) {
            const cameraSwitcher = document.querySelector("#camera-switcher") as HTMLInputElement;
            const cameraFieldOfViewContainer = document.querySelector("#camera-field-of-view-container") as HTMLElement;
            const rangeInput = document.querySelector("#camera-field-of-view-range-input") as HTMLInputElement;
            const numberInput = document.querySelector("#camera-field-of-view-input") as HTMLInputElement;

            if (cameraSwitcher && cameraFieldOfViewContainer) {
                // Set view mode
                if (viewpoint.camera_data.view_mode === "orthographic") {
                    cameraSwitcher.checked = true;
                    cameraFieldOfViewContainer.style.display = "none";
                    this._viewer.scene.camera.switchToOrthographicFrustum();
                } else {
                    cameraSwitcher.checked = false;
                    cameraFieldOfViewContainer.style.display = "block";
                    this._viewer.scene.camera.switchToPerspectiveFrustum();

                    // Set field of view if in perspective mode
                    if (viewpoint.camera_data.field_of_view && rangeInput && numberInput) {
                        const fov = viewpoint.camera_data.field_of_view;
                        rangeInput.value = fov.toString();
                        numberInput.value = fov.toString();
                        this._updateCameraFov(fov);
                    }
                }
            }
        }

        // Update camera position and rotation in both form and viewer
        if (viewpoint.camera_data) {
            // Temporarily remove camera change listener to prevent feedback loop
            const tempListener = this._cameraChangeListener;
            if (tempListener) {
                this._viewer.camera.changed.removeEventListener(tempListener);
            }

            try {
                // Update position
                if (viewpoint.camera_data.position) {
                    const positionInputs = Array.from(
                        document.querySelectorAll('.camera-input[data-type="position"]')
                    ) as HTMLInputElement[];
                    if (positionInputs.length >= 3) {
                        const x = Number(viewpoint.camera_data.position.x);
                        const y = Number(viewpoint.camera_data.position.y);
                        const z = Number(viewpoint.camera_data.position.z);

                        positionInputs[0].value = x.toFixed(8);
                        positionInputs[1].value = y.toFixed(8);
                        positionInputs[2].value = z.toFixed(3);

                        // Update camera position
                        const cartographic = new Cesium.Cartographic(
                            Cesium.Math.toRadians(x),
                            Cesium.Math.toRadians(y),
                            z
                        );
                        const destination = this._viewer.scene.globe.ellipsoid.cartographicToCartesian(cartographic);
                        this._viewer.camera.position = destination;
                    }
                }

                // Update rotation
                if (viewpoint.camera_data.rotation) {
                    const rotationInputs = Array.from(
                        document.querySelectorAll('.camera-input[data-type="rotation"]')
                    ) as HTMLInputElement[];
                    if (rotationInputs.length >= 3) {
                        const pitch = Number(viewpoint.camera_data.rotation.x);
                        const heading = Number(viewpoint.camera_data.rotation.y);
                        const roll = Number(viewpoint.camera_data.rotation.z);

                        rotationInputs[0].value = pitch.toFixed(1);
                        rotationInputs[1].value = heading.toFixed(1);
                        rotationInputs[2].value = roll.toFixed(1);

                        // Update camera rotation
                        this._viewer.camera.setView({
                            orientation: {
                                heading: Cesium.Math.toRadians(heading),
                                pitch: Cesium.Math.toRadians(pitch),
                                roll: Cesium.Math.toRadians(roll)
                            }
                        });
                    }
                }

                // Request a render to update the view
                this._viewer.scene.requestRender();
            } finally {
                // Restore the camera change listener
                if (tempListener) {
                    this._viewer.camera.changed.addEventListener(tempListener);
                }
            }
        }

        // Update transition settings
        const transitionType = form.querySelector(
            `input[name="transition-type"][value="${viewpoint.transition_type}"]`
        ) as HTMLInputElement;
        if (transitionType) {
            transitionType.checked = true;
            if (viewpoint.transition_type === "smooth") {
                window.jQuery("#transition-duration-group").show();
                const durationInput = form.querySelector("#transition-duration") as HTMLInputElement;
                if (durationInput) {
                    durationInput.value = viewpoint.transition_duration.toString();
                }
            }
        }

        // Update save button text
        this._updateSaveButtonText("Edit Viewpoint");

        // Update the trigger button text to show we're in edit mode
        const triggerButton = document.querySelector(".camera-viewpoints-trigger");
        if (triggerButton) {
            triggerButton.innerHTML = '<i class="gwicon-edit"></i> Edit Viewpoints';
        }
    }

    async handleDeleteViewpoint(e: Event): Promise<void> {
        const button = e.target as HTMLElement;
        const viewpointItem = button.closest(".viewpoint-item");
        if (!viewpointItem) return;

        const viewpointId = viewpointItem.getAttribute("data-id");
        if (!viewpointId) return;
        if (!window.confirm("Are you sure you want to delete this viewpoint?")) {
            return;
        }

        // Show loading indicator
        window.jQuery(".ck-processing-loader").addClass("shown");

        try {
            const response = await this._deleteCameraViewpoint(viewpointId);
            // Hide loading indicator
            window.jQuery(".ck-processing-loader").removeClass("shown");

            if (response.success) {
                this.refreshViewpointsList();
            } else {
                alert("Error deleting viewpoint. Please try again.");
            }
        } catch (error) {
            console.error("Error deleting viewpoint:", error);
            alert("Error deleting viewpoint. Please try again.");
            // Hide loading indicator
            window.jQuery(".ck-processing-loader").removeClass("shown");
        }
    }

    async handleMakeDefaultViewpoint(e: Event): Promise<void> {
        e.preventDefault();
        e.stopPropagation();

        // Get the star button that was clicked
        const starButton = e.target as HTMLElement;
        const viewpointItem = starButton.closest(".viewpoint-item");

        if (!viewpointItem) return;

        const viewpointId = viewpointItem.getAttribute("data-id");
        if (!viewpointId) return;

        // Show loading indicator
        window.jQuery(".ck-processing-loader").addClass("shown");

        // Fetch viewpoint data to construct view data
        try {
            const response = await this._getCameraViewpoint(viewpointId);

            if (response.success) {
                // Construct view data from viewpoint data
                const viewData = CameraViewpoints._constructViewDataFromViewpoint(response.data.viewpoint);

                // Save the view data
                await saveCurrentView(viewData);

                // Save the default viewpoint ID
                await saveDefaultViewpointId(viewpointId);

                // Update the stored default viewpoint ID
                this._defaultViewpointId = viewpointId;

                // Update visual feedback - make this star filled and others unfilled
                CameraViewpoints._updateStarVisualFeedback(viewpointId);

                alert("Default view set successfully!");
            } else {
                alert("Error loading viewpoint data. Please try again.");
            }

            // Hide loading indicator
            window.jQuery(".ck-processing-loader").removeClass("shown");
        } catch (error) {
            // Hide loading indicator
            window.jQuery(".ck-processing-loader").removeClass("shown");
            console.error("Error fetching viewpoint data:", error);
            alert("Error loading viewpoint data. Please try again.");
        }
    }

    private static _updateStarVisualFeedback(selectedViewpointId: string): void {
        // Reset all stars to unfilled (gray)
        const allStarButtons = document.querySelectorAll(".star-viewpoint-btn");
        allStarButtons.forEach((button) => {
            const starSpan = button.querySelector("span") as HTMLElement;
            if (starSpan) {
                starSpan.style.color = "#ccc";
                starSpan.textContent = "☆"; // Unfilled star
            }
        });

        // Make the selected star filled (blue)
        const selectedStarButton = document.querySelector(
            `.viewpoint-item[data-id="${selectedViewpointId}"] .star-viewpoint-btn`
        );
        if (selectedStarButton) {
            const selectedStarSpan = selectedStarButton.querySelector("span") as HTMLElement;
            if (selectedStarSpan) {
                selectedStarSpan.style.color = "#4a90e2";
                selectedStarSpan.textContent = "★"; // Filled star
            }
        }
    }

    handleChangeViewpoint(e: Event): void {
        e.preventDefault();
        const viewer = this._viewer;
        const camera = viewer.camera;

        // Get current camera values
        const position = camera.position;
        const cartographic = viewer.scene.globe.ellipsoid.cartesianToCartographic(position);

        // Update position inputs
        const positionInputs = Array.from(
            document.querySelectorAll('.camera-input[data-type="position"]')
        ) as HTMLInputElement[];
        positionInputs[0].value = Cesium.Math.toDegrees(cartographic.longitude).toFixed(8);
        positionInputs[1].value = Cesium.Math.toDegrees(cartographic.latitude).toFixed(8);
        positionInputs[2].value = cartographic.height.toFixed(3);

        // Update rotation inputs
        const rotationInputs = Array.from(
            document.querySelectorAll('.camera-input[data-type="rotation"]')
        ) as HTMLInputElement[];
        rotationInputs[0].value = Cesium.Math.toDegrees(camera.pitch).toFixed(1);
        rotationInputs[1].value = Cesium.Math.toDegrees(camera.heading).toFixed(1);
        rotationInputs[2].value = Cesium.Math.toDegrees(camera.roll).toFixed(1);
        // Update the featured image
        viewer.scene.requestRender();
        viewer.render();
        const mediumQuality = viewer.canvas.toDataURL("image/jpeg", 0.5);

        // Update the featured image
        const featuredImage = window.jQuery("#capture-cameraviewpoint-image");
        if (featuredImage.length > 0 && featuredImage.find("img").length > 0) {
            featuredImage.find("img").attr("src", mediumQuality);
        } else {
            window
                .jQuery(".camera-viewpoints-trigger")
                .before(`<div id="capture-cameraviewpoint-image"><img src="${mediumQuality}" /></div>`);
        }
    }

    private static _constructViewDataFromViewpoint(viewpoint: any): string {
        const viewData = {
            longitude: viewpoint.camera_data.position ? viewpoint.camera_data.position.x : 0,
            latitude: viewpoint.camera_data.position ? viewpoint.camera_data.position.y : 0,
            height: viewpoint.camera_data.position ? viewpoint.camera_data.position.z : 0,
            heading: viewpoint.camera_data.rotation ? viewpoint.camera_data.rotation.y : 0,
            pitch: viewpoint.camera_data.rotation ? viewpoint.camera_data.rotation.x : 0,
            roll: viewpoint.camera_data.rotation ? viewpoint.camera_data.rotation.z : 0,
            view_mode: viewpoint.camera_data.view_mode || "perspective",
            field_of_view: viewpoint.camera_data.field_of_view
        };

        return JSON.stringify(viewData);
    }
}

export default CameraViewpoints;
