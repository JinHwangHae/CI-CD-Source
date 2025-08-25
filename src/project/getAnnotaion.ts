import * as JQuery from "jquery";

type GetAnnotationAjaxResponse = {
    status: number;
    msg: string;
    data: string; // html
};

export default function getAnnotation(clicked: JQuery) {
    const jQuery = window.jQuery;

    // tinymce.remove();

    const buttonText = clicked.html();
    const nonce = jQuery('[name="ck_get_annotation_nonce"]').val();
    const annotationId = clicked.attr("data-id");

    // Change button text
    clicked.addClass("disable-click");

    jQuery(".ck-processing-loader").addClass("shown");

    const data = {
        action: "get_annotation",
        nonce: nonce,
        annotation_id: annotationId
    };

    jQuery.post(window.gowatch.ajaxurl, data, (res: GetAnnotationAjaxResponse) => {
        // console.log(res.data)
        jQuery(".annotation-details-modal").html(res.data);

        // // //init quicktags
        // quicktags({id : 'comment'});
        // // //init tinymce
        // tinymce.init({selector: ".annotation-details-modal #comment", plugins: "lists,link",  branding: false, menubar: false, toolbar: 'bold,italic,underline,bullist,numlist,link,unlink,forecolor,undo,redo' });

        clicked.html(buttonText);
        clicked.removeClass("disable-click");

        jQuery(".annotation-details-modal .icon-close")[0].addEventListener(
            "click",
            () => {
                jQuery(".annotation-details-modal").html("");
            },
            {
                once: true
            }
        );

        jQuery(".view-annotation-modal").resizable({
            minHeight: 150,
            stop: function () {
                const modalSize = {
                    w: jQuery(".view-annotation-modal").outerWidth(),
                    h: jQuery(".view-annotation-modal").outerHeight()
                };
                localStorage.setItem("ck-modal-size", JSON.stringify(modalSize));
            }
        });

        // Align it properly
        const initialPositionJsonStr: string | null = localStorage.getItem("ck-modal-position");
        const initialSizeJsonStr: string | null = localStorage.getItem("ck-modal-size");

        if (initialPositionJsonStr) {
            const initialPosition = JSON.parse(initialPositionJsonStr);

            jQuery(".view-annotation-modal").css("left", initialPosition.x);
            jQuery(".view-annotation-modal").css("top", initialPosition.y);
        }

        if (initialSizeJsonStr) {
            const initialSize = JSON.parse(initialSizeJsonStr);

            jQuery(".view-annotation-modal").css("width", initialSize.w);
            jQuery(".view-annotation-modal").css("height", initialSize.h);
        }

        jQuery(".view-annotation-modal").draggable({
            handle: ".ck-modal-header",
            start: function () {},
            drag: function () {},
            stop: function () {
                const coordinates = {
                    x: jQuery(".view-annotation-modal").offset().left,
                    y: jQuery(".view-annotation-modal").offset().top
                };

                localStorage.setItem("ck-modal-position", JSON.stringify(coordinates));
            }
        });

        jQuery(".ck-processing-loader").removeClass("shown");
    });
}
