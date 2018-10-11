const path = require("path");
const spawn = require("child_process");
const Events = require("events");

const cOptions = {
    encoding: "utf8",
    timeout: 1000,
    windowsHide: true
};
const scan = {
    cmd: "ping",
    count: " -n 1",
    timeout: " -w 500",
    command() {return this.cmd + this.count + this.timeout + " ";}
};

class ContinousPing extends Events {
    start(ip, interval) {
        this.active = true;
        this._ping(ip, interval);
    }
    stop() {
        this.active = false;
        // clearTimeout(timeout);
    }
    _ping(ip, interval) {
        ping(ip)
        .then(result => {
            if(!this.active) return;
            this.timeout = setTimeout(() => {
                this._ping(ip, interval);
            }, interval);
            this.emit("ping", result);
        })
        .catch(error => this.emit("error", error));
    }
}

module.exports = new ContinousPing();

function ping(ip) {
    return new Promise(function (resolve, reject) {
        spawn.exec(scan.command() + ip, cOptions, (error, data) => {
            if(error) {
                if(error.code === 1) return resolve(undefined);
                return reject(error);
            }
            if(!data) {
                console.log(data);
                return reject(undefined);
            }
            const result = data.split("\n")[2].split(": ")[1].split(" ")[1].split("=")[1];

            return resolve(result);
        });
    });
}