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
    // Clear storage so reloads don't try to reconnect to a dead/removed ticket immediately 
    // (though server would reject it anyway, clearing it is cleaner or we can keep it to show "Removed" state?)
    // User wants "removed" state update. So let's NOT clear it maybe?
    // If we clear it, they go back to "Join" screen.
    // If we keep it, we can show "Removed" forever until they clear cache?
    // Let's keep it but show a persistent "Removed" UI.
    // If they refresh, server emits 'ticket_removed' again, so it persists. OK.

    document.querySelector('h1').textContent = "Status";
    document.getElementById('my-number').textContent = "Removed";
    document.getElementById('my-number').classList.remove('loader');
    document.getElementById('my-number').style.color = "#ff4d4d"; // Red color
    document.getElementById('people-ahead').textContent = "-";
}

function updateStatus(servingStart) {
    if (myTicketNumber === null) return;

    // If we are seeing "Removed" (manually set), don't overwrite it with queued status?
    // But `myTicketNumber` is still set.
    // We need a flag or just rely on server not sending updates for us? 
    // The server still sends broadcast queue updates.
    // We should check if we are removed? Client doesn't know easily unless we track state.
    // Let's rely on the fact that if we are removed, we shouldn't care about queue updates.
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
        // Still waiting
        // Display #Position (e.g. #1, #2)
        document.querySelector('h1').textContent = "Your Position";
        myNumberElem.textContent = '#' + myPosition;

        const ahead = myPosition - 1;
        peopleAheadElem.textContent = ahead;
    }
}
