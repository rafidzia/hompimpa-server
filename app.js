const app = require('express')()
const server = require("http").Server(app)
const io = require('socket.io')(server, {
    cors: {
        origin: "*"
    }
})
const crypto = require("crypto")

console.log('Socket-io server running on 8080.');

app.get("/", (req, res) => {
    res.send("asd")
})

var rooms = []
var users = []
var results = []
var suitScores = []

io.on('connection', function (socket) {
    console.log("connected")
    // socket.emit("message", socket.id)
    // socket.emit("asd", "asd")
    socket.on("asd", (asd) => {
        console.log(asd)
    })
    socket.on("createroom", (dataRoom) => {
        let newRoomId;
        let passed = false
        while (!passed) {
            newRoomId = crypto.randomBytes(3).toString("hex")
            if (!rooms.find(el => el.room == newRoomId)) {
                passed = true
            }
        }
        socket.join(newRoomId)
        socket.roomId = newRoomId
        socket.username = ""

        dataRoom.room = newRoomId
        // console.log(JSON.stringify(dataRoom))
        rooms.push(dataRoom)

        if (!users[socket.roomId]) { users[socket.roomId] = [] }
        users[socket.roomId].push("");

        socket.emit("joined", { room: newRoomId })
    })
    socket.on("joinroom", (dataRoom) => {
        if (rooms.find(el => el.room == dataRoom.room && el.mode == dataRoom.mode)) {
            if (dataRoom.mode == "suit" && users[dataRoom.room].length >= 2) {
                socket.emit("failjoin", 1)
                return;
            }
            if (dataRoom.mode == "hompimpa" && users[dataRoom.room].length >= 10) {
                socket.emit("failjoin", 1)
                return;
            }
            socket.join(dataRoom.room);
            socket.roomId = dataRoom.room
            socket.username = ""

            console.log(socket.roomId)

            if (!users[socket.roomId]) { users[socket.roomId] = [] }
            users[socket.roomId].push("")

            socket.emit("joined", { room: socket.roomId })
        } else {
            socket.emit("failjoin", 1)
        }
    })

    socket.on("leaveroom", () => {
        leaving(socket)
    })

    socket.on("userready", () => {
        if (!users[socket.roomId]) { users[socket.roomId] = [] }
        bcuser(socket)
    })

    socket.on("createuser", (username) => {

        if (!users[socket.roomId]) { users[socket.roomId] = [] }
        if (users[socket.roomId].indexOf(username) > -1) {
            socket.emit("userexist", 1);
            return;
        }
        let indexUsr = users[socket.roomId].indexOf(socket.username)
        // console.log(indexUsr)
        if (indexUsr > -1) {
            users[socket.roomId][indexUsr] = username
        } else {
            users[socket.roomId][users[socket.roomId].indexOf("")] = username;
        }
        socket.username = username

        bcuser(socket)

        let mode = rooms.find(el => el.room == socket.roomId).mode;
        if ((mode == "suit" && users[socket.roomId].length >= 2) || (mode == "hompimpa" && users[socket.roomId].length >= 2)) {
            if (users[socket.roomId].find(el => el == "") == undefined) {
                io.to(socket.roomId).emit("startinit");
            }

        }
    })

    socket.on("choosesuit", (choice) => {
        if (!results[socket.roomId]) { results[socket.roomId] = {} }
        if (!results[socket.roomId].results) { results[socket.roomId].results = [] }
        if (!suitScores[socket.roomId]) { suitScores[socket.roomId] = {} }
        if (!suitScores[socket.roomId][socket.username]) { suitScores[socket.roomId][socket.username] = 0 }
        if (!users[socket.roomId]) { users[socket.roomId] = [] }
        results[socket.roomId].results.push({ username: socket.username, choice: choice })
        console.log(results[socket.roomId])
        // console.log(suitScores[socket.roomId])
        if (results[socket.roomId].results.length == users[socket.roomId].length) {
            // console.log("asd")
            io.to(socket.roomId).emit("finishchoosesuit")
        }
    })

    socket.on("movetoresultsuit", () => {
        if (results[socket.roomId].results.length > 0) {
            io.to(socket.roomId).emit("gameresult", results[socket.roomId])

            let yourChoice = results[socket.roomId].results.find(el => el.username == socket.username).choice
            let enemy = results[socket.roomId].results.find(el => el.username != socket.username)
            let enemyChoice = enemy.choice
            if ((yourChoice == "paper" && enemyChoice == "rock") || (yourChoice == "rock" && enemyChoice == "scissor") || (yourChoice == "scissor" && enemyChoice == "paper")) {
                suitScores[socket.roomId][socket.username] += 1;
            } else if ((yourChoice == "paper" && enemyChoice == "scissor") || (yourChoice == "rock" && enemyChoice == "paper") || (yourChoice == "scissor" && enemyChoice == "rock")) {
                suitScores[socket.roomId][enemy.username] += 1;
            }
            io.to(socket.roomId).emit("suitscore", suitScores[socket.roomId])
            results[socket.roomId].results = []
        }

    })

    socket.on("choosehompimpa", (choice) => {
        if (!results[socket.roomId]) { results[socket.roomId] = {} }
        if (!results[socket.roomId].results) { results[socket.roomId].results = [] }
        results[socket.roomId].results.push({ username: socket.username, choice: choice })
        io.to(socket.roomId).emit("totalchoose", { now: results[socket.roomId].results.length, total: users[socket.roomId].length })
        if (results[socket.roomId].results.length == users[socket.roomId].length) {
            // console.log("asd")
            io.to(socket.roomId).emit("finishchoosehom")
        }
    })

    socket.on("movetowaitinghom", () => {
        io.to(socket.roomId).emit("totalchoose", { now: results[socket.roomId].results.length, total: users[socket.roomId].length })
    })

    socket.on("movetoresulthom", () => {
        if (results[socket.roomId].results.length > 0) {
            io.to(socket.roomId).emit("gameresult", results[socket.roomId])
            results[socket.roomId].results = []
        }
    })

    socket.on("disconnect", () => {
        leaving(socket)
        console.log("disconnected")

    })


});

function leaving(socket) {
    socket.join(socket.id)
    if (socket.roomId) {
        if (users[socket.roomId].length > 0) users[socket.roomId].splice(users[socket.roomId].indexOf(socket.username), 1)
        bcuser(socket)
        if (users[socket.roomId].length < 1) {
            if (users.length > 0) users.splice(users.indexOf(socket.roomId), 1)
            if (rooms.length > 0) rooms.splice(users.indexOf(socket.roomId), 1)
        }
        socket.roomId = undefined
        socket.username = undefined
        console.log("leaving");
    }
}

function bcuser(socket) {
    let asduser = [];
    for (let i = 0; i < users[socket.roomId].length; i++) {
        asduser[i] = {};
        asduser[i].username = users[socket.roomId][i];
    }
    io.to(socket.roomId).emit("bcuser", { users: asduser })
}

server.listen(process.env.PORT || 8080);