const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');
const os = require('os');

app.use(express.static('public'));

// Read admin password
const fs = require('fs');
let ADMIN_PASSWORD = "admin"; // Default
try {
    ADMIN_PASSWORD = fs.readFileSync('admin_password', 'utf8').trim();
    console.log("Admin password loaded.");
} catch (e) {
    console.warn("Could not read admin_password file, using default.");
}

let ticketCounter = 0; // Latest ticket number
let servingCounter = 1; // Ticket number currently served
let tickets = {}; // Map ticketId -> Name
let removedTickets = new Set(); // Removed tickets

io.on('connection', (socket) => {
    let isAdmin = false;

    socket.on('request_ticket', (name) => {
        ticketCounter++;
        const myTicket = ticketCounter;
        const userName = name || "name";
        tickets[myTicket] = userName;

        socket.emit('ticket_assigned', {
            ticketNumber: myTicket,
            servingNumber: servingCounter,
            position: (myTicket - servingCounter + 1)
        });

        broadcastUpdate();
    });

    socket.on('reconnect_user', (ticketId) => {
        const tid = parseInt(ticketId, 10);

        if (removedTickets.has(tid)) {
            socket.emit('ticket_removed');
            return;
        }

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

    socket.on('admin_login', (password) => {
        if (password === ADMIN_PASSWORD) {
            isAdmin = true;
            socket.emit('login_success');
            broadcastUpdate(); // Send initial data
        } else {
            socket.emit('login_fail');
        }
    });

    socket.on('admin_next', () => {
        if (!isAdmin) {
            console.log("Unauthorized admin_next attempt");
            return;
        }

        if (servingCounter <= ticketCounter) {
            delete tickets[servingCounter];
            servingCounter++;
            broadcastUpdate();
        }
    });

    socket.on('admin_remove_ticket', (ticketId) => {
        if (!isAdmin) {
            console.log("Unauthorized admin_remove_ticket attempt");
            return;
        }

        const tid = parseInt(ticketId, 10);
        removedTickets.add(tid);

        if (tickets[tid]) {
            delete tickets[tid];
            broadcastUpdate();
        }

        io.emit('ticket_removed_broadcast', tid);
    });

    function broadcastUpdate() {
        // First 20 people waiting
        let waitingList = [];
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
