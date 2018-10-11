const fs = require("fs-extra");

module.exports = (error, log) => {
    fs.ensureFile(log)
    .then(() => {
        fs.appendFile(log, error)
        .catch(error => {
            console.error(error);
        });
    })
    .catch(error => {
        console.error(error);
    });
};