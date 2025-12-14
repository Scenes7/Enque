const socket = io();

// UI Elements
const loginModal = document.getElementById('login-modal');
const passInput = document.getElementById('admin-pass');
const loginBtn = document.getElementById('login-btn');

loginBtn.addEventListener('click', () => {
    const password = passInput.value;
    socket.emit('admin_login', password);
});

passInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loginBtn.click();
});

socket.on('login_success', () => {
    loginModal.classList.add('hidden');
});

socket.on('login_fail', () => {
    alert('Incorrect Password');
    passInput.value = '';
});

// Identify as admin (will fail actions if not logged in via admin_login)
// socket.emit('admin_connect'); // Removed

socket.on('queue_update', (data) => {
    const serving = data.servingNumber;
    const last = data.lastTicket;
    const list = data.waitingList || [];

    document.getElementById('now-serving').textContent = '#' + serving;

    let peopleInSystem = last - serving + 1;
    if (peopleInSystem < 0) peopleInSystem = 0;

    document.getElementById('queue-size').textContent = peopleInSystem;

    // Render waiting list
    const listContainer = document.getElementById('waiting-list');
    listContainer.innerHTML = '';

    list.forEach((item, index) => {
        // item has .number and .name
        const div = document.createElement('div');
        div.className = 'list-item';
        // HTML structure with Remove button
        div.innerHTML = `
            <div class="item-left">
                <span class="item-pos">#${item.number}</span> 
                <span>${item.name}</span>
            </div>
            <button class="remove-btn" onclick="removeUser(${item.number})">&times;</button>
        `;
        listContainer.appendChild(div);
    });
});

// Expose removal function to window scope so onclick works
window.removeUser = function (ticketId) {
    if (confirm(`Remove ticket #${ticketId}?`)) {
        socket.emit('admin_remove_ticket', ticketId);
    }
};

document.getElementById('next-btn').addEventListener('click', () => {
    socket.emit('admin_next');
});
