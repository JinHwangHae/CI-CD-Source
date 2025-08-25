import * as JQuery from "jquery";

export default function annotationComment(form: JQuery) {
    // Create the data

    const formBox = form.parents(".annotation-comments");
    const theForm = new FormData();
    const formParams = form.serializeArray();

    // define some vars
    const button = $(formBox).find("#submit"); // submit button
    const buttonText = $(formBox).find("#submit").val(); // submit button
    const respond = $(formBox).find("#respond"); // comment form container
    const commentlist = $(formBox).find(".commentlist"); // comment list container
    const cancelreplylink = $(formBox).find("#cancel-comment-reply-link");

    // @ts-ignore if user is logged in, do not validate author and email fields
    if ($(formBox).find("#author").length) $(formBox).find("#author").validate();

    if (
        $(formBox).find("#comment").length &&
        $(formBox).find("#comment").val() === "" &&
        jQuery("#annotation-comment-attachment").val() === ""
    )
        alert("Error, empty comment!");

    // @ts-ignore
    if ($(formBox).find("#email").length) $(formBox).find("#email").validateEmail();

    // if comment form isn't in process, submit it
    if (
        !button.hasClass("loadingform") &&
        !$(formBox).find("#author").hasClass("error") &&
        !$(formBox).find(" #email").hasClass("error") &&
        !$(formBox).find("#comment").hasClass("error")
    ) {
        $.each(form.find('input[type="file"]'), (i: any, tag: any) => {
            $.each($(tag)[0].files, (j: any, file: any) => {
                theForm.append(tag.name, file);
            });
        });

        $.each(formParams, (i: any, val: any) => {
            theForm.append(val.name, val.value);
        });

        // Add the right action to this
        theForm.append("action", "annotation_add_comment");

        // ajax request
        $.ajax({
            method: "POST",
            processData: false,
            contentType: false,
            cache: false,
            enctype: "multipart/form-data",
            url: window.gowatch.ajaxurl, // admin-ajax.php URL
            data: theForm, // send form data + action parameter
            beforeSend: function () {
                // what to do just after the form has been submitted
                button.addClass("loadingform").attr("disabled", "disabled").val("Loading...");
            },
            error: function (request: any, status: any) {
                if (status === 500) {
                    alert("Error while adding comment");
                } else if (status === "timeout") {
                    alert("Error: Server doesn't respond.");
                } else {
                    // process WordPress errors
                    const wpErrorHtml = request.responseText.split("<p>");
                    const wpErrorStr = wpErrorHtml[1].split("</p>");

                    alert(wpErrorStr[0]);
                }
            },
            success: function (addedCommentHTML: string) {
                // if( addedCommentHTML.status == 'success' ) {
                //     var url = addedCommentHTML.redirect;
                //     window.location.replace(url);
                // }

                jQuery(".ck-processing-loader").removeClass("shown");
                jQuery(".comments-attachment-field").remove();

                // if this post already has comments
                if (commentlist.length > 0) {
                    // if in reply to another comment
                    if (respond.parent().hasClass("comment")) {
                        // if the other replies exist
                        if (respond.parent().children(".children").length) {
                            respond.parent().children(".children").append(addedCommentHTML);
                        } else {
                            // if no replies, add <ol class="children">

                            // eslint-disable-next-line no-param-reassign
                            addedCommentHTML = `<ol class="children">${addedCommentHTML}</ol>`;
                            respond.parent().append(addedCommentHTML);
                        }
                        // close respond form
                        cancelreplylink.trigger("click");
                    } else {
                        // simple comment
                        commentlist.append(addedCommentHTML);
                    }
                } else {
                    // if no comments yet

                    // eslint-disable-next-line no-param-reassign
                    addedCommentHTML = `<ol class="commentlist">${addedCommentHTML}</ol>`;
                    respond.before($(addedCommentHTML));
                }

                const entityId = jQuery("#comment").attr("data-comment-entity-id");
                const entityCommentCount =
                    jQuery(`#form-check-${entityId}`).find(".annotation-comments em").length !== 0
                        ? parseInt(jQuery(`#form-check-${entityId}`).find(".annotation-comments em").text(), 10)
                        : 0;

                if (entityCommentCount === 0) {
                    jQuery(`#form-check-${entityId}`).find(".annotation-comments").append(`<em>${1}</em>`);
                    jQuery("#no-comments").remove();
                } else {
                    jQuery(`#form-check-${entityId}`)
                        .find(".annotation-comments em")
                        .html((entityCommentCount + 1).toString());
                }
                // clear textarea field
                $(formBox).find("#comment").val("");
                $(formBox).find("#annotation-comment-attachment").val("").trigger("change");
                $(formBox).find('label[for="annotation-comment-attachment"]').removeClass("hidden");

                // Fix for the WP editor
                // tinymce.get('comment').setContent('');
            },
            complete: function () {
                // what to do after a comment has been added
                button.removeClass("loadingform").val("Success!");
                setTimeout(() => {
                    button.removeAttr("disabled").val(buttonText as string);
                }, 2000);
            }
        });
    }
}
