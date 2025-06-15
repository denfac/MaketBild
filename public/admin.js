document.addEventListener('DOMContentLoaded', () => {
    const userTable = document.getElementById('user-table');
    const projectTable = document.getElementById('project-table');
    const requestTable = document.getElementById('request-table');
    const backToEditorBtn = document.getElementById('back-to-editor');
    const logoutBtn = document.getElementById('logout-btn');
    const emailForm = document.getElementById('email-form');
    const emailStatus = document.getElementById('email-status');

    // Загрузка пользователей
    function loadUsers() {
        fetch('/api/admin/users', { credentials: 'include' })
            .then(res => {
                if (!res.ok) throw new Error('Unauthorized');
                return res.json();
            })
            .then(users => {
                userTable.innerHTML = '';
                users.forEach(user => {
                    const tr = document.createElement('tr');
                    const isActive = user.last_login ? 'Активен' : 'Неактивен';
                    tr.innerHTML = `
                        <td>${user.id}</td>
                        <td>${user.name}</td>
                        <td>${user.email}</td>
                        <td>${user.role}</td>
                        <td>${new Date(user.created_at).toLocaleString()}</td>
                        <td>${user.last_login ? new Date(user.last_login).toLocaleString() : '–'}</td>
                        <td>${isActive}</td>
                        <td><button onclick="deleteUser(${user.id})">Удалить</button></td>
                    `;
                    userTable.appendChild(tr);
                });
            })
            .catch(err => {
                console.error('Error loading users:', err);
                window.location.href = '/auth';
            });
    }

    // Загрузка проектов
    function loadProjects() {
        fetch('/api/admin/projects', { credentials: 'include' })
            .then(res => {
                if (!res.ok) throw new Error('Unauthorized');
                return res.json();
            })
            .then(projects => {
                projectTable.innerHTML = '';
                projects.forEach(project => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${project.id}</td>
                        <td>${project.name}</td>
                        <td>${project.user_name}</td>
                        <td>${new Date(project.created_at).toLocaleString()}</td>
                        <td><button onclick="deleteProject(${project.id})">Удалить</button></td>
                    `;
                    projectTable.appendChild(tr);
                });
            })
            .catch(err => console.error('Error loading projects:', err));
    }

    // Загрузка заявок
    function loadRequests() {
        fetch('/api/admin/project-requests', { credentials: 'include' })
            .then(res => {
                if (!res.ok) throw new Error('Unauthorized');
                return res.json();
            })
            .then(requests => {
                requestTable.innerHTML = '';
                requests.forEach(request => {
                    const tr = document.createElement('tr');
                    tr.setAttribute('data-request-id', request.id); // Сохраняем requestId как атрибут
                    tr.innerHTML = `
                        <td>${request.id}</td>
                        <td>${request.project_name}</td>
                        <td>${request.user_name}</td>
                        <td>${request.status}</td>
                        <td>${new Date(request.created_at).toLocaleString()}</td>
                        <td>${new Date(request.updated_at).toLocaleString()}</td>
                        <td>
                            ${request.status === 'pending' ? `
                                <button class="approve" onclick="approveRequest(${request.id})">Одобрить</button>
                                <button onclick="rejectRequest(${request.id})">Отклонить</button>
                                <button onclick="viewProject(${request.project_id})">Подробности</button>
                            ` : `<button onclick="viewProject(${request.project_id})">Подробности</button>`}
                        </td>
                    `;
                    requestTable.appendChild(tr);
                });
            })
            .catch(err => console.error('Error loading requests:', err));
    }

    // Переход к проекту
    window.viewProject = (projectId) => {
        window.location.href = `/projects/${projectId}`; // Перенаправление на страницу проекта
    };

    // Удаление пользователя
    window.deleteUser = async (userId) => {
        if (confirm('Удалить пользователя?')) {
            try {
                const res = await fetch(`/api/admin/users/${userId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Error deleting user');
                alert(data.message);
                loadUsers();
            } catch (err) {
                alert('Ошибка удаления пользователя: ' + err.message);
            }
        }
    };

    // Удаление проекта
    window.deleteProject = async (projectId) => {
        if (confirm('Удалить проект?')) {
            try {
                const res = await fetch(`/api/admin/projects/${projectId}`, {
                    method: 'DELETE',
                    credentials: 'include'
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Error deleting project');
                alert(data.message);
                loadProjects();
            } catch (err) {
                alert('Ошибка удаления проекта: ' + err.message);
            }
        }
    };

    // Одобрение заявки
    window.approveRequest = async (requestId) => {
        try {
            const res = await fetch(`/api/admin/project-requests/${requestId}/approve`, {
                method: 'PUT',
                credentials: 'include'
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error approving request');
            alert(data.message);
            loadRequests();
        } catch (err) {
            alert('Ошибка одобрения заявки: ' + err.message);
        }
    };

    // Отклонение заявки
    window.rejectRequest = async (requestId) => {
        try {
            const res = await fetch(`/api/admin/project-requests/${requestId}/reject`, {
                method: 'PUT',
                credentials: 'include'
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error rejecting request');
            alert(data.message);
            loadRequests();
        } catch (err) {
            alert('Ошибка отклонения заявки: ' + err.message);
        }
    };

    // Отправка письма
    emailForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const subject = document.getElementById('email-subject').value;
        const body = document.getElementById('email-body').value;
        if (!subject || !body) {
            emailStatus.textContent = 'Пожалуйста, заполните тему и текст письма';
            return;
        }
        try {
            const res = await fetch('/api/send-email-admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: 'anohindanil905@gmail.com', subject, body }),
                credentials: 'include'
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error sending email');
            emailStatus.textContent = 'Письмо успешно отправлено';
            emailForm.reset();
        } catch (err) {
            emailStatus.textContent = 'Ошибка отправки: ' + err.message;
        }
    });

    backToEditorBtn.addEventListener('click', () => {
        window.location.href = '/editor';
    });

    logoutBtn.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/logout', {
                method: 'POST',
                credentials: 'include'
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error logging out');
            window.location.href = data.redirect;
        } catch (err) {
            alert('Ошибка выхода: ' + err.message);
        }
    });

    // Initial load
    loadUsers();
    loadProjects();
    loadRequests();
});