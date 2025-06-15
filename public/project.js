document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('projectId') || window.location.pathname.split('/').pop(); // Адаптируйте под ваш маршрут

    fetch(`/api/projects/${projectId}`, { credentials: 'include' })
        .then(res => {
            if (!res.ok) throw new Error('Project not found');
            return res.json();
        })
        .then(project => {
            const detailsDiv = document.getElementById('project-details');
            detailsDiv.innerHTML = `
                <h2>${project.name}</h2>
                <p>Создан: ${new Date(project.created_at).toLocaleString()}</p>
                <h3>Элементы:</h3>
                <ul>
                    ${project.data.map(el => `
                        <li>
                            Тип: ${el.type}, Координаты: (${el.x}, ${el.y}), Размеры: ${el.width}x${el.height},
                            ${el.text ? `Текст: "${el.text}", ` : ''}${el.color ? `Цвет: ${el.color}` : ''}
                        </li>
                    `).join('')}
                </ul>
            `;
        })
        .catch(err => {
            document.getElementById('project-details').innerHTML = `<p>Ошибка: ${err.message}</p>`;
        });
});