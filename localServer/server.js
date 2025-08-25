const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());

const port = 1218;

const server = app.listen(port, () => {
    const host = server.address().address;

    console.info("Example app listening at http://%s:%s", host, server.address().port);
});

app.use(express.static(__dirname));
