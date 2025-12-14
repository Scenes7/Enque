const socket = io();
let myTicketNumber = null;
let myName = "";

const modal = document.getElementById('name-modal');
const input = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');

// Check for existing ticket
const storedTicket = localStorage.getItem('queue_ticket');

socket.on('connect', () => {
    const currentTicket = localStorage.getItem('queue_ticket');
    if (currentTicket) {
        console.log('Attempting reconnect with ticket', currentTicket);
        socket.emit('reconnect_user', currentTicket);
    } else {
        modal.classList.remove('hidden');
        input.focus();
    }
});

// Listen for storage changes from other tabs
window.addEventListener('storage', (e) => {
    if (e.key === 'queue_ticket') {
        if (e.newValue) {
            // Another tab joined!
            console.log('Another tab joined, syncing state...');
            myName = "Synced User";
            modal.classList.add('hidden');
            socket.emit('reconnect_user', e.newValue);
        } else {
            // Ticket removed (invalidated) in another tab
            console.log('Ticket removed in another tab');
            myTicketNumber = null;
            modal.classList.remove('hidden');
            document.getElementById('my-number').textContent = '...';
        }
    }
});

joinBtn.addEventListener('click', () => {
    // Pre-flight check: Did we join in another tab just now?
    if (localStorage.getItem('queue_ticket')) {
        console.log('Already joined in another tab, aborting new join request.');
        modal.classList.add('hidden');
        socket.emit('reconnect_user', localStorage.getItem('queue_ticket'));
        return;
    }

    const nameVal = input.value.trim() || "name";
    myName = nameVal;
    modal.classList.add('hidden');

    // Request ticket with name
    socket.emit('request_ticket', myName);
});

// Allow Enter key
input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinBtn.click();
});

socket.on('ticket_assigned', (data) => {
    myTicketNumber = data.ticketNumber;
    // Persist
    localStorage.setItem('queue_ticket', myTicketNumber);

    document.getElementById('ticket-id').textContent = '#' + myTicketNumber;
    document.getElementById('my-number').classList.remove('loader');

    // If modal was open/visible (e.g. we reconnected and it was hiding, or we just joined), ensure it's hidden
    modal.classList.add('hidden');

    updateStatus(data.servingNumber);
});

socket.on('invalid_ticket', () => {
    // Server said our ticket is junk (e.g. server restart)
    console.log('Invalid ticket, clearing storage');
    localStorage.removeItem('queue_ticket');
    myTicketNumber = null;
    modal.classList.remove('hidden');
    document.getElementById('my-number').textContent = '...';
    document.getElementById('my-number').classList.add('loader');
});

socket.on('queue_update', (data) => {
    updateStatus(data.servingNumber);
});

function updateStatus(servingStart) {
    if (myTicketNumber === null) return;

    const myPosition = myTicketNumber - servingStart + 1;
    const myNumberElem = document.getElementById('my-number');
    const peopleAheadElem = document.getElementById('people-ahead');

    if (myPosition <= 0) {
        // We have been served
        document.querySelector('h1').textContent = "Status";
        myNumberElem.textContent = "Served";
        peopleAheadElem.textContent = "0";
    } else {
        // Still waiting
        // Display #Position (e.g. #1, #2)
        document.querySelector('h1').textContent = "Your Position";
        myNumberElem.textContent = '#' + myPosition;

        const ahead = myPosition - 1;
        peopleAheadElem.textContent = ahead;
    }
}
