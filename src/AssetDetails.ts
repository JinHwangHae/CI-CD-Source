import { ParsedConstruktedAjax } from "./types/common";

interface FormElements {
    viewAccess: HTMLInputElement;
    title: HTMLInputElement;
    captureDate: HTMLInputElement;
    tags: HTMLInputElement;
    downloadAccess: HTMLInputElement;
    coordinateSystem: HTMLInputElement;
    status: HTMLInputElement;
}

interface FormDataType {
    action: string;
    post_id: string | undefined;
    title: string;
    description: string;
    captureDate: string;
    categories: string[];
    tags: string;
    viewAccess: string;
    downloadAccess: string;
    coordinateSystem: string;
    status: string;
}
interface AjaxResponse {
    success: boolean;
    data: {
        message: string;
        new_status: string;
        title: string;
        description: string;
        date_capture: string;
        view_access: string;
        download_access: string;
        tags: string[];
        categories: string[];
    };
}

class AssetDetail {
    private _CONSTRUKTED_AJAX: ParsedConstruktedAjax;
    private _initialStatus: string | undefined; // <-- Add this line

    constructor() {
        this._CONSTRUKTED_AJAX = window.CONSTRUKTED_AJAX;
        this.init();
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        const jQuery = window.jQuery;
        // First remove existing handlers
        jQuery(document).off("click", ".asset-details-editor-trigger");
        jQuery(document).off("click", ".close-editor");
        jQuery(document).off("click", "#nav-info");
        jQuery(document).off("click", ".save-asset-details");

        // Then add new handlers
        jQuery(document).on("click", ".asset-details-editor-trigger", jQuery.proxy(this.handleShowAssetEditor, this));
        jQuery(document).on("click", ".close-editor", jQuery.proxy(AssetDetail.hideAssetEditor, this));
        jQuery(document).on("click", "#nav-info", jQuery.proxy(AssetDetail.toggleAssetInfo, this));
        jQuery(document).on("click", ".save-asset-details", jQuery.proxy(this.handleSaveAssetDetails, this));
    }

    // Add this method to capture the initial status when editor opens
    handleShowAssetEditor(): void {
        // Get the current status value when opening the editor
        const statusElement = document.querySelector<HTMLInputElement>('input[name="asset-status"]:checked');
        this._initialStatus = statusElement?.value;
        AssetDetail.showAssetEditor();
    }

    static showAssetEditor(): void {
        const editor = window.jQuery("#construkted-popup-asset-editor");
        if (editor.length === 0) {
            return;
        }
        editor.addClass("is-shown").show();
    }

    static hideAssetEditor(): void {
        const editor = window.jQuery("#construkted-popup-asset-editor");
        editor.hide();
    }

    static toggleAssetInfo(): void {
        const info = window.jQuery("#construkted-popup-info");
        info.toggleClass("is-shown");
    }

    static getSelectedCategories(): string[] {
        const categories: string[] = [];
        const checkboxes = document.querySelectorAll<HTMLInputElement>('input[id$="-category"]:checked');
        checkboxes.forEach((checkbox) => {
            categories.push(checkbox.value);
        });
        return categories;
    }

    handleSaveAssetDetails(e: Event): void {
        e.preventDefault();
        const button = e.target as HTMLButtonElement;
        if (button.disabled) {
            return;
        }
        button.disabled = true;

        // Use the stored initial status
        const prevStatus = this._initialStatus;

        // Check if status is "Published" - log the value to debug
        const statusElement = document.querySelector<HTMLInputElement>('input[name="asset-status"]:checked');
        const status = statusElement?.value;
        const isPublished = status === "1"; // Changed from 'published' to 'publish'

        // Only validate if status is "Published"
        if (isPublished) {
            // Validate required fields
            const titleElement = document.getElementById("asset-title") as HTMLInputElement;
            const title = titleElement?.value.trim();
            if (!title) {
                alert("Asset title is required");
                titleElement?.focus();
                button.disabled = false;
                return;
            }

            const description = window.tinymce.get("asset-description")?.getContent().trim();
            if (!description) {
                alert("Asset description is required");
                button.disabled = false;
                return;
            }

            const captureDateElement = document.getElementById("asset-capture-date") as HTMLInputElement;
            if (!captureDateElement?.value) {
                alert("Capture date is required");
                captureDateElement?.focus();
                button.disabled = false;
                return;
            }

            const categories = AssetDetail.getSelectedCategories();
            if (categories.length === 0) {
                alert("Please select at least one category");
                button.disabled = false;
                return;
            }

            const viewAccess = document.querySelector('input[name="view-access"]:checked');
            if (!viewAccess) {
                alert("View access is required");
                button.disabled = false;
                return;
            }

            const downloadAccess = document.querySelector('input[name="download-access"]:checked');
            if (!downloadAccess) {
                alert("Download access is required");
                button.disabled = false;
                return;
            }

            const coordinateSystem = document.querySelector('input[name="coordinate-system"]:checked');
            if (!coordinateSystem) {
                alert("Coordinate system is required");
                button.disabled = false;
                return;
            }
        }

        const formElements = AssetDetail._getFormElements();
        const formData = AssetDetail._createFormData(formElements, button.dataset.postId);

        // Pass previous status to _submitFormData
        this._submitFormData(formData, button, prevStatus);
    }

    private static _getFormElements(): FormElements {
        const title = document.getElementById("asset-title") as HTMLInputElement;
        const captureDate = document.getElementById("asset-capture-date") as HTMLInputElement;
        const tags = document.getElementById("asset-tags") as HTMLInputElement;

        // Create empty input elements for optional fields
        const emptyInput = document.createElement("input");

        // Get selected values or use empty input if not selected
        const viewAccess = document.querySelector<HTMLInputElement>('input[name="view-access"]:checked') || emptyInput;
        const downloadAccess =
            document.querySelector<HTMLInputElement>('input[name="download-access"]:checked') || emptyInput;
        const coordinateSystem =
            document.querySelector<HTMLInputElement>('input[name="coordinate-system"]:checked') || emptyInput;
        const status = document.querySelector<HTMLInputElement>('input[name="asset-status"]:checked') || emptyInput;

        return {
            viewAccess,
            title,
            captureDate,
            tags,
            downloadAccess,
            coordinateSystem,
            status
        };
    }

    private static _createFormData(elements: FormElements, postId: string | undefined): FormDataType {
        return {
            action: "save_asset_details",
            post_id: postId,
            title: elements.title.value,
            description: window.tinymce.get("asset-description")?.getContent() || "",
            captureDate: elements.captureDate.value,
            categories: AssetDetail.getSelectedCategories(),
            tags: elements.tags.value,
            viewAccess: elements.viewAccess.value,
            downloadAccess: elements.downloadAccess.value,
            coordinateSystem: elements.coordinateSystem.value,
            status: elements.status.value
        };
    }

    private _submitFormData(formData: FormDataType, button: HTMLButtonElement, prevStatus?: string): void {
        window.jQuery.ajax({
            url: this._CONSTRUKTED_AJAX.ajaxurl,
            type: "POST",
            data: formData,
            success: (response: AjaxResponse) => {
                if (response.success) {
                    alert("Asset details saved successfully!");
                    AssetDetail.hideAssetEditor();
                    // Check if status changed from draft ("0") to publish ("1")
                    if (prevStatus === "0" && response.data.new_status === "publish") {
                        window.location.reload();
                        return;
                    }

                    const currentUrl = window.location.href;
                    const baseUrl = currentUrl.split("?")[0];
                    window.location.href = baseUrl;

                    const data = response.data;
                    const popup = window.jQuery("#construkted-popup-info");
                    // Update title (the h2 span that contains the title)
                    popup.find("h2 > span:first").text(data.title);
                    popup.find(".post-content").html(data.description);
                    // Update categories
                    if (data.categories && data.categories.length > 0) {
                        const categoriesHtml = `<ul class="mb-2 nostyle">${data.categories
                            .map(
                                (category) => `
                                <li class="term-${category}">
                                    <a href="/video-category/${category}/">${
                                    category.charAt(0).toUpperCase() + category.slice(1)
                                }</a>
                                </li>`
                            )
                            .join("")}</ul>`;
                        popup.find(".make-flex-row .make-flex").html(categoriesHtml);
                    }
                    // Update capture date
                    if (data.date_capture) {
                        const dateMetadata = `
                            <div class="metadata-item">
                                <strong class="text-sm">Date of capture</strong>
                                ${data.date_capture}
                            </div>`;

                        // Find or create the metadata container
                        let metadataList = popup.find(".metadata-list");
                        if (!metadataList.length) {
                            popup.find(".asset-metadata-inner").html('<div class="metadata-list"></div>');
                            metadataList = popup.find(".metadata-list");
                        }

                        // Update or append the date metadata
                        const existingDateItem = metadataList.find(
                            ".metadata-item:has(strong:contains('Date of capture'))"
                        );
                        if (existingDateItem.length) {
                            existingDateItem.replaceWith(dateMetadata);
                        } else {
                            metadataList.prepend(dateMetadata);
                        }
                    }
                    // Update download access
                    if (data.download_access) {
                        const downloadLink = popup.find("a[download]");
                        if (data.download_access !== "allow_download") {
                            downloadLink.parent("div").hide();
                        } else {
                            downloadLink.parent("div").show();
                        }
                    }
                } else {
                    alert("An error occurred while saving the asset details. Please try again.");
                }
                button.disabled = false;
            },
            error: (error: any) => {
                console.error("Error saving asset details:", error);
                button.disabled = false;
                alert("An error occurred while saving the asset details. Please try again.");
            }
        });
    }
}

export default AssetDetail;
