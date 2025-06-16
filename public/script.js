document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    const templateModal = document.getElementById('template-modal');
    const profileModal = document.getElementById('profile-modal');
    const logoutBtn = document.getElementById('logout-btn');
    const adminPanelBtn = document.getElementById('admin-panel');
    const userInfo = document.querySelector('.user-info');
    const projectList = document.getElementById('project-list');
    const requestList = document.getElementById('request-list');
    const projectSelect = document.getElementById('request-project-id');
    const closeTemplateModal = document.querySelector('#template-modal .close');
    const closeProfileModal = document.querySelector('#profile-modal .close');

    let selectedElement = null;
    let elements = [];
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let scale = 1.0; // Начальный масштаб

    if (!canvas || !ctx) {
        alert('Ошибка: Canvas не найден');
        return;
    }

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Проверка сессии и загрузка данных пользователя
    fetch('/api/user', { method: 'GET', credentials: 'include' })
        .then(res => {
            console.log('Проверка сессии на /editor, статус:', res.status);
            if (!res.ok) {
                console.log('Ответ сервера:', res.statusText);
                throw new Error('Unauthorized');
            }
            return res.json();
        })
        .then(data => {
            console.log('Данные пользователя:', data);
            userInfo.textContent = `Привет, ${data.name}!`;
            if (data.role === 'admin') {
                adminPanelBtn.style.display = 'inline-block';
            }
            loadProjects();
            loadRequests();
        })
        .catch(err => {
            console.error('Ошибка проверки сессии:', err);
            window.location.href = '/auth';
        });

    // Переход в админ-панель
    adminPanelBtn.addEventListener('click', () => {
        window.location.href = '/admin';
    });

    // Выход
    logoutBtn.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/logout', { method: 'POST', credentials: 'include' });
            const data = await res.json();
            console.log('Ответ на выход:', data);
            if (!res.ok) throw new Error(data.error || 'Ошибка выхода');
            window.location.href = data.redirect;
        } catch (err) {
            console.error('Ошибка выхода:', err);
            alert('Ошибка выхода: ' + err.message);
        }
    });

    // Добавление элементов
    document.getElementById('add-text').addEventListener('click', () => {
        elements.push({ type: 'text', x: 50, y: 50, width: 200, height: 30, text: 'Новый текст', color: '#000000' });
        renderCanvas();
    });

    document.getElementById('add-button').addEventListener('click', () => {
        elements.push({ type: 'button', x: 50, y: 50, width: 100, height: 40, text: 'Кнопка', color: '#3498DB' });
        renderCanvas();
    });

    document.getElementById('add-image').addEventListener('click', () => {
        elements.push({ type: 'image', x: 50, y: 50, width: 100, height: 100, src: 'https://via.placeholder.com/100', color: '#FFFFFF' });
        renderCanvas();
    });

    document.getElementById('add-block').addEventListener('click', () => {
        elements.push({ type: 'block', x: 50, y: 50, width: 200, height: 100, color: '#CCC' });
        renderCanvas();
    });

    // Удаление элемента
    document.getElementById('delete-element').addEventListener('click', () => {
        if (selectedElement) {
            elements = elements.filter(el => el !== selectedElement);
            selectedElement = null;
            updateProperties();
            renderCanvas();
        }
    });

    // Сохранение проекта
    document.getElementById('save-project').addEventListener('click', async () => {
        const projectName = prompt('Введите название проекта:');
        if (projectName) {
            try {
                const res = await fetch('/api/projects', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: projectName, data: elements }),
                    credentials: 'include'
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Ошибка сохранения');
                alert('Проект сохранен с ID: ' + data.id);
                loadProjects();
            } catch (err) {
                alert('Ошибка сохранения: ' + err.message);
            }
        }
    });

    // Скачивание проекта как изображения
    document.getElementById('download-project').addEventListener('click', () => {
        const projectName = prompt('Введите название проекта для скачивания:', 'project');
        if (projectName) {
            // Рендеринг с фоном перед скачиванием
            renderCanvasWithBackground();
            const dataURL = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = dataURL;
            link.download = `${projectName}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            // Возвращаем стандартный рендеринг
            renderCanvas();
        }
    });

    // Отправка по email
    document.getElementById('send-email').addEventListener('click', async () => {
        const recipient = prompt('Введите email получателя:');
        if (recipient) {
            try {
                const res = await fetch('/api/send-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recipient, projectData: elements }),
                    credentials: 'include'
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Ошибка отправки');
                alert('Проект отправлен на ' + recipient);
            } catch (err) {
                alert('Ошибка отправки: ' + err.message);
            }
        }
    });

    // Открытие и закрытие модального окна шаблонов
    document.getElementById('template-select').addEventListener('click', () => {
        templateModal.style.display = 'flex';
    });

    closeTemplateModal.addEventListener('click', () => {
        templateModal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === templateModal) {
            templateModal.style.display = 'none';
        }
    });

    // Обработка выбора шаблона
    document.querySelectorAll('.template-card').forEach(card => {
        card.addEventListener('click', () => {
            const template = card.dataset.template;
            elements = [];
            if (template === 'landing') {
                elements.push({ type: 'text', x: 50, y: 50, width: 200, height: 30, text: 'Заголовок лендинга', color: '#000000' });
                elements.push({ type: 'button', x: 50, y: 100, width: 100, height: 40, text: 'Купить', color: '#3498DB' });
            } else if (template === 'blog') {
                elements.push({ type: 'text', x: 50, y: 50, width: 200, height: 30, text: 'Название блога', color: '#000000' });
                elements.push({ type: 'block', x: 50, y: 100, width: 300, height: 200, color: '#CCC' });
            } else if (template === 'portfolio') {
                elements.push({ type: 'image', x: 50, y: 50, width: 100, height: 100, src: 'https://via.placeholder.com/100', color: '#FFFFFF' });
            }
            renderCanvas();
            templateModal.style.display = 'none';
        });
    });

    // Открытие и закрытие модального окна профиля
    document.getElementById('profile').addEventListener('click', () => {
        profileModal.style.display = 'flex';
        loadProjects();
        loadRequests();
    });

    closeProfileModal.addEventListener('click', () => {
        profileModal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === profileModal) {
            profileModal.style.display = 'none';
        }
    });

    // Отправка заявки
    document.getElementById('submit-request').addEventListener('click', async () => {
        const projectId = document.getElementById('request-project-id').value;
        if (!projectId) {
            alert('Пожалуйста, выберите проект');
            return;
        }
        try {
            const res = await fetch('/api/project-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ project_id: projectId }),
                credentials: 'include'
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Ошибка отправки заявки');
            alert('Заявка отправлена с ID: ' + data.id);
            loadRequests();
            projectSelect.value = '';
        } catch (err) {
            alert('Ошибка отправки заявки: ' + err.message);
        }
    });

    // Загрузка проектов
    function loadProjects() {
        fetch('/api/projects', { credentials: 'include' })
            .then(res => {
                console.log('Загрузка проектов, статус:', res.status);
                if (!res.ok) throw new Error('HTTP error');
                return res.json();
            })
            .then(projects => {
                projectList.innerHTML = '';
                projectSelect.innerHTML = '<option value="">-- Выберите проект --</option>';
                projects.forEach(project => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        ${project.name} (Создан: ${new Date(project.created_at).toLocaleString()})
                        <div>
                            <button onclick="editProject(${project.id})">Редактировать</button>
                            <button class="delete" onclick="deleteProject(${project.id})">Удалить</button>
                        </div>
                    `;
                    projectList.appendChild(li);
                    const option = document.createElement('option');
                    option.value = project.id;
                    option.textContent = project.name;
                    projectSelect.appendChild(option);
                });
            })
            .catch(err => console.error('Ошибка загрузки проектов:', err));
    }

    // Загрузка заявок
    function loadRequests() {
        fetch('/api/project-requests', { credentials: 'include' })
            .then(res => {
                if (!res.ok) throw new Error('HTTP error');
                return res.json();
            })
            .then(requests => {
                requestList.innerHTML = '';
                requests.forEach(request => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        Проект: ${request.project_name} (Статус: ${request.status}, Создан: ${new Date(request.created_at).toLocaleString()})
                    `;
                    requestList.appendChild(li);
                });
            })
            .catch(err => console.error('Ошибка загрузки заявок:', err));
    }

    window.editProject = (id) => {
        alert('Редактирование проекта с ID: ' + id);
    };

    window.deleteProject = async (id) => {
        if (confirm('Удалить проект?')) {
            try {
                const res = await fetch(`/api/projects/${id}`, { method: 'DELETE', credentials: 'include' });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Ошибка удаления');
                alert(data.message);
                loadProjects();
            } catch (err) {
                alert('Ошибка удаления: ' + err.message);
            }
        }
    };

    document.getElementById('change-password').addEventListener('click', () => {
        alert('Функция изменения пароля в разработке');
    });

    function renderCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.scale(scale, scale); // Применяем масштаб
        // Устанавливаем фон
        ctx.fillStyle = '#FFFFFF'; // Белый фон
        ctx.fillRect(0, 0, canvas.width / scale, canvas.height / scale);
        elements.forEach(el => {
            if (el.type === 'text') {
                ctx.fillStyle = el.color || '#000000';
                ctx.font = '16px Segoe UI';
                ctx.fillText(el.text, el.x / scale, el.y / scale + 20 / scale);
            } else if (el.type === 'button') {
                ctx.fillStyle = el.color || '#3498DB';
                ctx.fillRect(el.x / scale, el.y / scale, el.width / scale, el.height / scale);
                ctx.fillStyle = '#FFFFFF';
                ctx.font = '14px Segoe UI';
                ctx.fillText(el.text, el.x / scale + 10 / scale, el.y / scale + 25 / scale);
            } else if (el.type === 'image') {
                const img = new Image();
                img.src = el.src || 'https://via.placeholder.com/100';
                img.onload = () => ctx.drawImage(img, el.x / scale, el.y / scale, el.width / scale, el.height / scale);
            } else if (el.type === 'block') {
                ctx.fillStyle = el.color || '#CCC';
                ctx.fillRect(el.x / scale, el.y / scale, el.width / scale, el.height / scale);
            }
            if (el === selectedElement) {
                ctx.strokeStyle = 'red';
                ctx.lineWidth = 2 / scale;
                ctx.strokeRect(el.x / scale - 2 / scale, el.y / scale - 2 / scale, (el.width + 4) / scale, (el.height + 4) / scale);
            }
        });
        ctx.restore();
    }

    // Специальная функция для рендеринга с фоном перед скачиванием
    function renderCanvasWithBackground() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.scale(scale, scale);
        // Устанавливаем фон
        ctx.fillStyle = '#FFFFFF'; // Белый фон
        ctx.fillRect(0, 0, canvas.width / scale, canvas.height / scale);
        elements.forEach(el => {
            if (el.type === 'text') {
                ctx.fillStyle = el.color || '#000000';
                ctx.font = '16px Segoe UI';
                ctx.fillText(el.text, el.x / scale, el.y / scale + 20 / scale);
            } else if (el.type === 'button') {
                ctx.fillStyle = el.color || '#3498DB';
                ctx.fillRect(el.x / scale, el.y / scale, el.width / scale, el.height / scale);
                ctx.fillStyle = '#FFFFFF';
                ctx.font = '14px Segoe UI';
                ctx.fillText(el.text, el.x / scale + 10 / scale, el.y / scale + 25 / scale);
            } else if (el.type === 'image') {
                const img = new Image();
                img.src = el.src || 'https://via.placeholder.com/100';
                img.onload = () => ctx.drawImage(img, el.x / scale, el.y / scale, el.width / scale, el.height / scale);
            } else if (el.type === 'block') {
                ctx.fillStyle = el.color || '#CCC';
                ctx.fillRect(el.x / scale, el.y / scale, el.width / scale, el.height / scale);
            }
            if (el === selectedElement) {
                ctx.strokeStyle = 'red';
                ctx.lineWidth = 2 / scale;
                ctx.strokeRect(el.x / scale - 2 / scale, el.y / scale - 2 / scale, (el.width + 4) / scale, (el.height + 4) / scale);
            }
        });
        ctx.restore();
    }

    // Перетаскивание элементов
    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;
        selectedElement = elements.find(el =>
            x >= el.x / scale && x <= (el.x + el.width) / scale && y >= el.y / scale && y <= (el.y + el.height) / scale
        );
        if (selectedElement) {
            isDragging = true;
            dragStartX = x - selectedElement.x / scale;
            dragStartY = y - selectedElement.y / scale;
        }
        updateProperties();
        renderCanvas();
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isDragging && selectedElement) {
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / scale;
            const y = (e.clientY - rect.top) / scale;
            selectedElement.x = (x - dragStartX) * scale;
            selectedElement.y = (y - dragStartY) * scale;
            updateProperties();
            renderCanvas();
        }
    });

    canvas.addEventListener('mouseup', () => {
        isDragging = false;
    });

    canvas.addEventListener('mouseleave', () => {
        isDragging = false;
    });

    // Масштабирование холста
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        const newScale = Math.min(Math.max(scale + delta, 0.5), 2.0);
        if (newScale !== scale) {
            const rect = canvas.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left) / scale;
            const mouseY = (e.clientY - rect.top) / scale;

            elements.forEach(el => {
                el.x = (el.x - mouseX * scale) / scale * newScale + mouseX * newScale;
                el.y = (el.y - mouseY * scale) / scale * newScale + mouseY * newScale;
                el.width = el.width / scale * newScale;
                el.height = el.height / scale * newScale;
            });

            scale = newScale;
            renderCanvas();
        }
    });

    function updateProperties() {
        const inputs = {
            x: document.getElementById('prop-x'),
            y: document.getElementById('prop-y'),
            width: document.getElementById('prop-width'),
            height: document.getElementById('prop-height'),
            text: document.getElementById('prop-text'),
            color: document.getElementById('prop-color'),
            imageSrc: document.getElementById('prop-image-src')
        };
        if (selectedElement) {
            inputs.x.value = Math.round(selectedElement.x / scale);
            inputs.y.value = Math.round(selectedElement.y / scale);
            inputs.width.value = Math.round(selectedElement.width / scale);
            inputs.height.value = Math.round(selectedElement.height / scale);
            inputs.text.value = selectedElement.text || '';
            inputs.color.value = selectedElement.color || '#000000';
            inputs.imageSrc.value = selectedElement.src || '';
            Object.values(inputs).forEach(input => input.disabled = false);
        } else {
            Object.values(inputs).forEach(input => {
                input.value = '';
                input.disabled = true;
            });
        }
    }

    ['prop-x', 'prop-y', 'prop-width', 'prop-height'].forEach(id => {
        document.getElementById(id).addEventListener('input', (e) => {
            if (selectedElement) {
                selectedElement[id.replace('prop-', '')] = parseInt(e.target.value) * scale || 0;
                renderCanvas();
            }
        });
    });

    document.getElementById('prop-text').addEventListener('input', (e) => {
        if (selectedElement && (selectedElement.type === 'text' || selectedElement.type === 'button')) {
            selectedElement.text = e.target.value;
            renderCanvas();
        }
    });

    document.getElementById('prop-color').addEventListener('input', (e) => {
        if (selectedElement) {
            selectedElement.color = e.target.value;
            renderCanvas();
        }
    });

    document.getElementById('prop-image-src').addEventListener('input', (e) => {
        if (selectedElement && selectedElement.type === 'image') {
            selectedElement.src = e.target.value || 'https://via.placeholder.com/100';
            renderCanvas();
        }
    });
});