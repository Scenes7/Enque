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

let ticketCounter = 0; // The latest ticket number issued
let servingCounter = 1; // The ticket number currently being served
let tickets = {}; // Map ticketId -> Name
let removedTickets = new Set(); // Track removed/banned tickets

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
            // Calculate initial position
            position: (myTicket - servingCounter + 1)
        });

        broadcastUpdate();
    });

    socket.on('reconnect_user', (ticketId) => {
        const tid = parseInt(ticketId, 10);

        // Check if user was explicitly removed
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

    // Old unsecured event - keeping for compatibility but it won't work effectively without auth check if we enforce it. 
    // Actually, let's enforce it.
    // socket.on('admin_connect', () => { ... }); // Removed/Superceded by admin_login

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
        // We allow removing even if they aren't in `tickets` simply to ban them if needed, 
        // but typically they are in the list.
        removedTickets.add(tid);

        if (tickets[tid]) {
            delete tickets[tid];
            broadcastUpdate();
        }

        // Broadcast to everyone so the specific user can see they are removed
        io.emit('ticket_removed_broadcast', tid);
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
