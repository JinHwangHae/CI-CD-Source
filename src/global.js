/* eslint-disable */

const GlobeDisplayStatus = {
    Unknown: "unknown",
    Submitted: "submitted",
    Approved: "approved"
};

async function getAssetsAjax(args) {
    let result;

    try {
        result = await jQuery.ajax({
            url: CONSTRUKTED_AJAX.ajaxurl,
            type: "POST",
            data: args
        });
        return result;
    } catch (error) {
        console.error(error);
    }
}

export { getAssetsAjax, GlobeDisplayStatus };
