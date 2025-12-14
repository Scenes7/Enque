const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');
const os = require('os');

app.use(express.static('public'));

let ticketCounter = 0; // The latest ticket number issued
let servingCounter = 1; // The ticket number currently being served
let tickets = {}; // Map ticketId -> Name

io.on('connection', (socket) => {

    socket.on('request_ticket', (name) => {
        ticketCounter++;
        const myTicket = ticketCounter;
        const userName = name || "name";
        tickets[myTicket] = userName;

        socket.emit('ticket_assigned', {
            ticketNumber: myTicket,
            servingNumber: servingCounter,
            // Calculate initial position
            position: (myTicket - servingCounter + 1)
        });

        broadcastUpdate();
    });

    socket.on('reconnect_user', (ticketId) => {
        const tid = parseInt(ticketId, 10);
        if (tid > ticketCounter) {
            socket.emit('invalid_ticket');
            return;
        }

        if (tickets[tid]) {
            socket.emit('ticket_assigned', {
                ticketNumber: tid,
                servingNumber: servingCounter,
                position: (tid - servingCounter + 1)
            });
        } else {
            if (tid < servingCounter) {
                socket.emit('ticket_assigned', {
                    ticketNumber: tid,
                    servingNumber: servingCounter,
                    position: (tid - servingCounter + 1)
                });
            } else {
                socket.emit('invalid_ticket');
            }
        }
    });

    socket.on('admin_connect', () => {
        broadcastUpdate();
    });

    socket.on('admin_next', () => {
        if (servingCounter <= ticketCounter) {
            delete tickets[servingCounter];
            servingCounter++;
            broadcastUpdate();
        }
    });

    function broadcastUpdate() {
        // Prepare list of first 20 people waiting
        let waitingList = [];
        // Iterate from currently serving upwards
        for (let i = servingCounter; i <= ticketCounter; i++) {
            if (waitingList.length >= 20) break;
            if (tickets[i]) {
                waitingList.push({ number: i, name: tickets[i] });
            }
        }

        io.emit('queue_update', {
            lastTicket: ticketCounter,
            servingNumber: servingCounter,
            waitingList: waitingList
        });
    }
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`listening on *:${PORT}`);

    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip internal and non-ipv4
            if ('IPv4' !== iface.family || iface.internal) {
                continue;
            }
            console.log(`Network Access: http://${iface.address}:${PORT}`);
        }
    }
});
