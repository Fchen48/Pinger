const electron = require("electron");
const ElectronConfig = require("electron-config");
const config = new ElectronConfig();
const url = require("url");
const path = require("path");
const ping = require("./functions/ping");
const log = require("./functions/log");
const render = require("puppeteer-render-text");
const jimp = require("jimp");
const AutoLaunch = require("auto-launch");

let mainWindow;
let tray;
let trayIcon;
const width = 240;
const height = 360;
const errorlog = path.join(electron.app.getPath("userData"), "logs", "error.log");
const lastResults = [];
const autostart = new AutoLaunch({ name: "Pinger" });

// const generateTrayIcon = text => new Promise((resolve, reject) => {
//     render({
//         text,
//         output: "tray.png",
//         width: 64,
//         height: 64,
//         style: {
//             fontFamily: "sans-serif",
//             fontSize: 56,
//             color: "white",
//             width: "100%",
//             height: "100%",
//             "line-height": "64px",
//             "text-align": "center",
//             margin: 0
//         }
//     })
//     .then(() => resolve(path.join(__dirname, "tray.png")))
//     .catch(error => reject(error));
// });

const generateTrayIcon = text => new Promise((resolve, reject) => {
    jimp.loadFont(jimp.FONT_SANS_64_WHITE)
    .then(font => {
        jimp.read(80, 80, 0xfff)
        .then(img => {
            img.print(font, 0, 0, {
                text,
                alignmentX: jimp.HORIZONTAL_ALIGN_CENTER,
                alignmentY: jimp.VERTICAL_ALIGN_MIDDLE
            }, 80, 80)
            .resize(64, 64)
            .write("test.png")
            .getBuffer(jimp.MIME_PNG, (error, buffer) => {
                trayIcon = electron.nativeImage.createFromBuffer(buffer);
                return resolve();
            });
        })
        .catch(console.error);
    })
    .catch(console.error);
});

generateTrayIcon("--")
.catch(error => console.error(error));

electron.app.on("ready", () => {
    setTimeout(() => {
        const woptions = {
            show: false,
            frame: false,
            tranparent: true,
            width,
            minWidth: width,
            maxWidth: width,
            height,
            minHeight: height,
            maxHeight: height,
            resizeable: false,
            icon: path.join(__dirname, "images", "icon.png")
        };
        Object.assign(woptions, config.get("window"));
        mainWindow = new electron.BrowserWindow(woptions);
        mainWindow.loadURL(url.format({
            pathname: path.join(__dirname, "html", "index.html"),
            protocol: "file:",
            slashes: true
        }));
        mainWindow.on("close", () => {
            config.set("window", mainWindow.getBounds());
        });
        mainWindow.on("closed", () => {
            electron.app.quit();
        });
        mainWindow.on("hide", () => {
            // tray = new electron.Tray(path.join(__dirname, "tray.png"));
            console.log(trayIcon);
            tray = new electron.Tray(trayIcon);
            tray.on("click", () => {
                mainWindow.show();

            });
        });
        mainWindow.on("show", () => {
            tray.destroy();
        });
        mainWindow.once("ready-to-show", () => {
            mainWindow.show();
        });
    }, 100);
});

electron.ipcMain.on("window:minimize", () => {
    const window = electron.BrowserWindow.getFocusedWindow();
    if(window.isMinimized()) {
        window.restore();
        return;
    }
    window.hide();
});

electron.ipcMain.on("window:autostart", () => {
    autostart.isEnabled()
    .then(result => {
        if(result) {
            autostart.disable();
            config.set("autostart", false);
            mainWindow.webContents.send("autostart");
            return;
        }
        autostart.enable();
        config.set("autostart", true);
        mainWindow.webContents.send("autostart");
    })
    .catch(error => console.error(error));
});

electron.ipcMain.on("startPing", (event, data) => {
    if(!data) return;
    ping.start(data.ip, data.interval);
    mainWindow.webContents.send("start");
    config.set("ip", data.ip);
    config.set("interval", data.interval);
    config.set("active", true);
});

electron.ipcMain.on("stopPing", () => {
    ping.stop();
    mainWindow.webContents.send("stop");
    while(lastResults.length > 0) {
        lastResults.pop();
    }
    config.set("active", false);
});

ping.on("ping", result => {
    lastResults.push(result);
    let value = result;

    if(!result) {
        value = "";
        if(lastResults.every(e => e == undefined)) {
            value = "TIMEOUT";
        }
    }
    if(lastResults.length > 2) lastResults.shift();
    mainWindow.webContents.send("ping", value);
    if(value == "") return;
    let valueIcon = value.replace(/[^0-9]/g, "");
    if(value == "TIMEOUT") {
        valueIcon = "--";
    }
    if(tray) {
        if(!tray.isDestroyed()) {
            generateTrayIcon(valueIcon)
            // .then(() => {
            //     if(!tray.isDestroyed()) {

            //         tray.setImage(path.join(__dirname, "tray.png"));
            //     }
            // })
            .catch(error => console.error(error));
        }
    }
});

ping.once("error", error => {
    log(error, errorlog);
});

process.on("uncaughtException", (error) => {
    log(error, errorlog);
});