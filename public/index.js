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
            // Handle user opening multiple tabs without joining
            console.log('Another tab joined, syncing state...');
            myName = "Synced User";
            modal.classList.add('hidden');
            socket.emit('reconnect_user', e.newValue);
        } else {
            // Ticket removed in another tab
            console.log('Ticket removed in another tab');
            myTicketNumber = null;
            modal.classList.remove('hidden');
            document.getElementById('my-number').textContent = '...';
        }
    }
});

joinBtn.addEventListener('click', () => {
    // Check for other tab
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

    modal.classList.add('hidden');

    updateStatus(data.servingNumber);
});

socket.on('invalid_ticket', () => {
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

socket.on('ticket_removed', () => {
    handleRemoval();
});

socket.on('ticket_removed_broadcast', (removedId) => {
    if (myTicketNumber === removedId) {
        handleRemoval();
    }
});

function handleRemoval() {
    console.log("You have been removed from the queue.");

    document.querySelector('h1').textContent = "Status";
    document.getElementById('my-number').textContent = "Removed";
    document.getElementById('my-number').classList.remove('loader');
    document.getElementById('my-number').style.color = "#ff4d4d"; // Red color
    document.getElementById('people-ahead').textContent = "-";
}

function updateStatus(servingStart) {
    if (myTicketNumber === null) return;

    if (document.getElementById('my-number').textContent === "Removed") return;

    const myPosition = myTicketNumber - servingStart + 1;
    const myNumberElem = document.getElementById('my-number');
    const peopleAheadElem = document.getElementById('people-ahead');

    if (myPosition <= 0) {
        // We have been served
        document.querySelector('h1').textContent = "Status";
        myNumberElem.textContent = "Served";
        peopleAheadElem.textContent = "0";
    } else {
        // Still waiting, display #Position
        document.querySelector('h1').textContent = "Your Position";
        myNumberElem.textContent = '#' + myPosition;

        const ahead = myPosition - 1;
        peopleAheadElem.textContent = ahead;
    }
}
