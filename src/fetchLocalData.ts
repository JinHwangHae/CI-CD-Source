const localDataServerUrl = "http://localhost:1218";

export async function fetchLocalData(fileName: string) {
    try {
        const ajaxurl = `${localDataServerUrl}/${fileName}`;

        const res = await fetch(ajaxurl);
        const data = await res.json();

        return data;
    } catch (error) {
        return undefined;
    }
}
