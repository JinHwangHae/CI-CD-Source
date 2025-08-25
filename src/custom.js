/* qeslint-disable */
/* eslint-disable prefer-arrow-callback, no-bitwise, consistent-return */
// q@ts-nocheck

function custom($) {
    window.filesToUpload = [];

    jQuery(document).on("click", ".comments-attachment-field i.icon-delete", function () {
        jQuery("#annotation-comment-attachment").val("").trigger("change");
        jQuery(this).parent().remove();
    });

    jQuery(document).on("click", "#asset-list .icon-delete", function (e) {
        e.preventDefault();
        const r = window.confirm("Are you sure you want to delete this asset from the project?");

        if (r) {
            jQuery(".ck-processing-loader").addClass("shown");
            const asset = jQuery(this).parents(".make-flex");
            const assetId = jQuery(asset).find("input").attr("data-post-id");
            const nonce = jQuery('[name="ck_get_annotation_nonce"]').val();

            const data = {
                action: "remove_project_assets",
                asset: assetId,
                project: CONSTRUKTED_AJAX.post_id,
                nonce: nonce
            };

            jQuery.post(window.gowatch.ajaxurl, data, function (res) {
                if (res.status === 200) {
                    asset.remove();
                    // Remove the asset from the window assets object
                    window.assets = window.assets.filter((item) => {
                        if (item.post_id !== parseInt(assetId, 10)) return true;
                        return false;
                    });
                } else {
                    alert("There was an error:", res.msg);
                }
                jQuery(".ck-processing-loader").removeClass("shown");
            });
        }
    });

    jQuery(document).on("change", "#annotation-comment-attachment", function () {
        if (jQuery(this)[0].files && jQuery(this)[0].files[0] && jQuery(this)[0].files[0].name !== "") {
            jQuery(".annotation-comments #respond").before(
                // eslint-disable-next-line prefer-template
                '<div class="comments-attachment-field">Attached file: <strong>' +
                    jQuery(this)[0].files[0].name +
                    '</strong> <i class="icon-delete"></i></div>'
            );
            jQuery('label[for="annotation-comment-attachment"]').addClass("hidden");
        } else {
            jQuery('label[for="annotation-comment-attachment"]').removeClass("hidden");
        }
    });

    jQuery(document).on("mouseenter", ".annotation-info-box", function () {
        jQuery(this).parents(".annotation-line-item").removeClass("hovered");
        jQuery(this).remove();
    });

    jQuery("#scroll-down-btn").on("click", function () {
        const toScroll =
            jQuery(".post-meta").offset().top -
            jQuery(".featured-image").height() -
            jQuery("#header").height() +
            jQuery(".post-meta").height();

        $("html, body").animate({ scrollTop: toScroll }, 600);
    });

    jQuery(window).on("scroll", function () {
        if (jQuery(window).scrollTop() > 200) {
            jQuery("#scroll-down-btn").fadeOut(300);
        } else {
            jQuery("#scroll-down-btn").fadeIn(300);
        }
    });

    jQuery(".embed-code-link").on("click", function () {
        jQuery(".embed-content").toggleClass("in");

        return false;
    });

    jQuery(document).on("click", "#navbar-right .more-actions li .sidebar-tools-btn", function () {
        const clicked = jQuery(this);
        if (clicked.hasClass("inactive")) return;
        const action = clicked.attr("data-action");
        jQuery(`#${action}`).trigger("click");
    });

    jQuery(document).on("click", "#navbar-right .sidewide-actions li .sidebar-tools-btn", function () {
        const clicked = jQuery(this);
        if (clicked.hasClass("inactive")) return;
        jQuery(".popup-wrapper").hide();
        const action = clicked.attr("data-action");
        jQuery(`#sidebar-${action}`).toggle();
    });

    jQuery(document).on("click", ".annotation-line-item .annotation-icon", function () {
        const checkBox = jQuery(this).parents(".annotation-line-item").find("input");
        checkBox.prop("checked", !checkBox.prop("checked"));
        checkBox.trigger("change");
    });

    jQuery(document).on("click", ".send-comment", function () {
        jQuery(this).next().find("#submit").trigger("click");
    });

    $(document).on("input change load", ".range-slider", function () {
        $(this).next(".range-val").html(jQuery(this).val());
    });

    /*
     * Let's begin with validation functions
     */
    jQuery.extend(jQuery.fn, {
        /*
         * check if field value lenth more than 3 symbols ( for name and comment )
         */
        validate: function () {
            if (jQuery(this).val().length < 3) {
                jQuery(this).addClass("error");
                return false;
            }

            jQuery(this).removeClass("error");
            return true;
        },
        /*
         * check if email is correct
         * add to your CSS the styles of .error field, for example border-color:red;
         */
        validateEmail: function () {
            // eslint-disable-next-line no-useless-escape
            const emailReg = /^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/;
            const emailToValidate = jQuery(this).val();
            if (!emailReg.test(emailToValidate) || emailToValidate === "") {
                jQuery(this).addClass("error");
                return false;
            }

            jQuery(this).removeClass("error");
            return true;
        }
    });
}

export { custom };
