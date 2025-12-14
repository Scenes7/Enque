const socket = io();

// Identify as admin
socket.emit('admin_connect');

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
        // Show absolute ticket number and name
        div.innerHTML = `<span class="item-pos">#${item.number}</span> <span>${item.name}</span>`;
        listContainer.appendChild(div);
    });
});

document.getElementById('next-btn').addEventListener('click', () => {
    socket.emit('admin_next');
});
