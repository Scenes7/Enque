const io = require('socket.io-client');

const socket = io('http://localhost:3000');
let myTicket = null;

console.log("Connecting...");

socket.on('connect', () => {
    console.log("Connected to server.");
    socket.emit('request_ticket', 'Tester');
});

socket.on('ticket_assigned', (data) => {
    console.log("Ticket assigned:", data);
    myTicket = data.ticketNumber;

    if (data.position === 1 && data.ticketNumber > 0) {
        console.log("Test 1 Passed: Got ticket and position.");

        // Now simulate a disconnect/reconnect
        socket.disconnect();
        console.log("Disconnected. Reconnecting in 1s...");
        setTimeout(() => {
            const socket2 = io('http://localhost:3000');
            socket2.on('connect', () => {
                console.log("Reconnected (socket2). Emitting reconnect_user:", myTicket);
                socket2.emit('reconnect_user', myTicket);
            });

            socket2.on('ticket_assigned', (data2) => {
                if (data2.ticketNumber === myTicket) {
                    console.log("Test 2 Passed: Reconnected and got same ticket.");
                    process.exit(0);
                } else {
                    console.log("Test 2 Failed: Got different ticket", data2);
                    process.exit(1);
                }
            });

            socket2.on('invalid_ticket', () => {
                console.log("Test 2 Failed: Invalid ticket.");
                process.exit(1);
            });

        }, 1000);
    }
});

setTimeout(() => {
    console.log("Timeout waiting for response.");
    process.exit(1);
}, 5000);
