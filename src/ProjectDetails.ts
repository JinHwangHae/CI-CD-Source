import { ParsedConstruktedAjax } from "./types/common";
import { getCRSInfoFromEPSGInfoString } from "./core";

interface FormElements {
    projectTitle: HTMLInputElement;
    projectVisibility: HTMLInputElement;
    postPassword: HTMLInputElement;
    lengthUnit: HTMLSelectElement;
    areaUnit: HTMLSelectElement;
    volumeUnit: HTMLSelectElement;
    coordinateSystem: HTMLSelectElement;
    epsgInfoInput: HTMLInputElement;
    projectStatus: HTMLInputElement; // <-- Add this line
}

interface FormDataType {
    action: string;
    post_id: string | undefined;
    title: string;
    description: string;
    project_visibility: string;
    post_password: string;
    length_unit: string;
    area_unit: string;
    volume_unit: string;
    coordinate_system: string;
    epsg_info: string;
    project_status: string; // <-- Add this line
}

interface AjaxResponse {
    success: boolean;
    data: {
        message: string;
        title: string;
        description: string;
    };
}

class ProjectDetails {
    private _CONSTRUKTED_AJAX: ParsedConstruktedAjax;
    private _previousStatus: string | null = null; // <-- Add this line

    constructor() {
        this._CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;
        this.init();
    }

    init(): void {
        // Store the initial project status
        const statusInput = document.querySelector('input[name="project-status"]:checked') as HTMLInputElement;
        this._previousStatus = statusInput ? statusInput.value : null; // <-- Add this line
        this.bindEvents();
    }

    bindEvents(): void {
        const jQuery = window.jQuery;
        jQuery(document).on(
            "click",
            ".project-details-editor-trigger",
            jQuery.proxy(ProjectDetails.showProjectEditor, this)
        );
        jQuery(document).on("click", ".close-editor", jQuery.proxy(ProjectDetails.hideProjectEditor, this));
        jQuery(document).on("click", "#nav-info", jQuery.proxy(ProjectDetails.toggleProjectInfo, this));
        jQuery(document).on("click", ".save-project-details", jQuery.proxy(this.handleSaveProjectDetails, this));
    }

    static showProjectEditor(): void {
        const editor = window.jQuery("#construkted-popup-project-editor");
        if (editor.length === 0) {
            alert("Project editor not found");
            return;
        }
        editor.addClass("is-shown").show();
    }

    static hideProjectEditor(): void {
        window.jQuery("#construkted-popup-project-editor").hide();
    }

    static toggleProjectInfo(): void {
        window.jQuery("#construkted-popup-info").toggleClass("is-shown");
    }

    handleSaveProjectDetails(e: Event): void {
        e.preventDefault();
        const button = e.target as HTMLButtonElement;
        if (button.disabled) {
            return;
        }
        button.disabled = true;
        // Validate required fields
        const titleElement = document.getElementById("project-title") as HTMLInputElement;
        const title = titleElement?.value.trim();
        if (!title) {
            alert("Project title is required");
            titleElement?.focus();
            button.disabled = false;
            return;
        }

        const description = window.tinymce.get("project-description")?.getContent().trim();
        if (!description) {
            alert("Project description is required");
            button.disabled = false;
            return;
        }
        const formElements = ProjectDetails._getFormElements();
        if (!formElements) {
            console.error("Required form elements not found");
            button.disabled = false;
            return;
        }

        const epsgInfoInput = document.querySelector('input[id="epsg-info-input"]') as HTMLInputElement;

        const epsgInfo = epsgInfoInput.value;

        if (epsgInfo) {
            const crsInfo = getCRSInfoFromEPSGInfoString(epsgInfo);

            if (!crsInfo) {
                alert("Invalid EPSG!");
                button.disabled = false;
                return;
            }
        }

        const formData = ProjectDetails._createFormData(formElements, button.dataset.postId);
        this._submitFormData(formData, button);
    }

    private static _getFormElements(): FormElements | null {
        const projectTitle = document.getElementById("project-title") as HTMLInputElement;
        const projectVisibility = document.querySelector(
            'input[name="project-visibility"]:checked'
        ) as HTMLInputElement;
        const postPassword = document.getElementById("post-password") as HTMLInputElement;
        const lengthUnit = document.querySelector('select[name="length-unit"]') as HTMLSelectElement;
        const areaUnit = document.querySelector('select[name="area-unit"]') as HTMLSelectElement;
        const volumeUnit = document.querySelector('select[name="volume-unit"]') as HTMLSelectElement;
        const coordinateSystem = document.querySelector('select[name="coordinate-system"]') as HTMLSelectElement;
        const epsgInfoInput = document.querySelector('input[id="epsg-info-input"]') as HTMLInputElement;
        const projectStatus = document.querySelector('input[name="project-status"]:checked') as HTMLInputElement; // <-- Add this line

        if (
            !projectTitle ||
            !projectVisibility ||
            !postPassword ||
            !lengthUnit ||
            !areaUnit ||
            !volumeUnit ||
            !coordinateSystem ||
            !epsgInfoInput ||
            !projectStatus || // <-- Add this line
            !window.tinymce
        ) {
            return null;
        }

        return {
            projectTitle,
            projectVisibility,
            postPassword,
            lengthUnit,
            areaUnit,
            volumeUnit,
            coordinateSystem,
            epsgInfoInput,
            projectStatus // <-- Add this line
        };
    }

    private static _createFormData(elements: FormElements, postId: string | undefined): FormDataType {
        return {
            action: "save_project_details",
            post_id: postId,
            title: elements.projectTitle.value.trim(),
            description: window.tinymce.get("project-description")?.getContent() || "",
            project_visibility: elements.projectVisibility.value,
            post_password: elements.projectVisibility.value === "password" ? elements.postPassword.value : "",
            length_unit: elements.lengthUnit.value,
            area_unit: elements.areaUnit.value,
            volume_unit: elements.volumeUnit.value,
            coordinate_system: elements.coordinateSystem.value,
            epsg_info: elements.epsgInfoInput.value,
            project_status: elements.projectStatus.value // <-- Add this line
        };
    }

    private _submitFormData(formData: FormDataType, button: HTMLButtonElement): void {
        window.jQuery.ajax({
            url: this._CONSTRUKTED_AJAX.ajaxurl,
            type: "POST",
            data: formData,
            success: (response: AjaxResponse) => {
                button.disabled = false;
                if (response.success) {
                    alert("Project details saved successfully!");
                    ProjectDetails.hideProjectEditor();
                    const currentUrl = window.location.href;
                    const baseUrl = currentUrl.split("?")[0];
                    const popup = window.jQuery("#construkted-popup-info");
                    const data = response.data;
                    // Update title (the h2 span that contains the title)
                    popup.find("h2 > span:first").text(data.title);
                    popup.find(".post-content").html(data.description);

                    // Reload only if status changed from draft to published
                    if (this._previousStatus === "draft" && formData.project_status === "publish") {
                        window.location.reload();
                    } else {
                        window.location.href = baseUrl;
                    }
                } else {
                    alert("Error saving project details");
                }
                button.disabled = false;
            },
            error: (error: string) => {
                console.error("Save error:", { error });
                button.disabled = false;
                alert("Error saving project details");
            }
        });
    }
}

export default ProjectDetails;
