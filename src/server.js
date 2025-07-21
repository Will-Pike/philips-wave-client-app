const express = require('express');
const bodyParser = require('body-parser');
const setRoutes = require('./routes/index');

const app = express();
const PORT = process.env.PORT || 3000;

// Increase payload limits for large device lists
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('src/views'));

setRoutes(app);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});