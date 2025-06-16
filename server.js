const express = require('express');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const nodemailer = require('nodemailer');
const { initializeDatabase } = require('./database');
require('dotenv').config();

const app = express();
const PORT = 3001;

// Email transporter configuration
const createTransporter = () => {
    const provider = process.env.EMAIL_PROVIDER || 'gmail';
    if (provider === 'mailru') {
        return nodemailer.createTransport({
            host: 'smtp.mail.ru',
            port: 465,
            secure: true,
            auth: {
                user: process.env.MAILRU_USER,
                pass: process.env.MAILRU_PASS
            }
        });
    } else {
        return nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    }
};

const transporter = createTransporter();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' }
}));

let db;
initializeDatabase()
    .then(database => {
        db = database;
        console.log('Database initialized successfully');
    })
    .catch(err => {
        console.error('Failed to initialize database:', err);
        process.exit(1);
    });

const requireAuth = (req, res, next) => {
    console.log('Сессия:', req.session.user);
    if (!req.session.user) {
        console.log('Пользователь не авторизован, перенаправление на /auth');
        return res.redirect('/auth');
    }
    next();
};

const requireAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        console.log('Доступ запрещён, перенаправление на /editor');
        return res.redirect('/editor');
    }
    next();
};

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/auth', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});

app.get('/editor', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'editor.html'));
});

app.get('/projects/:id', requireAuth, (req, res) => {
    const projectId = req.params.id;
    db.get('SELECT id, name, data, created_at FROM projects WHERE id = ?', [projectId], (err, project) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        if (!project) return res.status(404).json({ error: 'Project not found' });
        project.data = JSON.parse(project.data); // Парсим JSON данные
        res.sendFile(path.join(__dirname, 'public', 'project.html')); // Предполагаемая страница проекта
    });
});

app.get('/projects', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'projects.html'));
});

app.get('/admin', requireAuth, requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/api/user', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json({ name: req.session.user.name, role: req.session.user.role });
});

app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }
    try {
        const hash = await bcrypt.hash(password, 10);
        db.run('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hash, 'user'], async function(err) {
                if (err) {
                    console.error('Ошибка при регистрации:', err.message);
                    return res.status(400).json({ error: 'Email уже существует' });
                }
                req.session.user = { id: this.lastID, email, name, role: 'user' };

                const mailOptions = {
                    from: `"МакетБилд" <${process.env.EMAIL_PROVIDER === 'mailru' ? process.env.MAILRU_USER : process.env.EMAIL_USER}>`,
                    to: email,
                    subject: 'Добро пожаловать в МакетБилд!',
                    html: `
                        <h2>Привет, ${name}!</h2>
                        <p>Спасибо за регистрацию в МакетБилд! Теперь вы можете создавать свои сайты легко и быстро.</p>
                        <p>Начните прямо сейчас: <a href="http://localhost:${PORT}/editor">Перейти в редактор</a></p>
                        <p>Если у вас есть вопросы, пишите нам на <a href="mailto:info@maketbuild.ru">info@maketbuild.ru</a>.</p>
                        <p>С уважением,<br>Команда МакетБилд</p>
                    `
                };

                try {
                    await transporter.sendMail(mailOptions);
                    console.log(`Welcome email sent to ${email} via ${process.env.EMAIL_PROVIDER || 'gmail'}`);
                } catch (emailErr) {
                    console.error(`Ошибка отправки email к ${email} через ${process.env.EMAIL_PROVIDER || 'gmail'}:`, emailErr.message);
                }

                req.session.save(err => {
                    if (err) {
                        console.error('Ошибка сохранения сессии:', err.message);
                        return res.status(500).json({ error: 'Ошибка сохранения сессии' });
                    }
                    res.json({ message: 'Регистрация успешна', redirect: '/editor' });
                });
            });
    } catch (err) {
        console.error('Ошибка сервера при регистрации:', err.message);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });
    try {
        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
            if (err || !user) return res.status(404).json({ error: 'Неверный email или пароль' });
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(400).json({ error: 'Неверный пароль' });
            db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
            req.session.user = { id: user.id, email: user.email, name: user.name, role: user.role };
            req.session.save(err => {
                if (err) return res.status(500).json({ error: 'Ошибка сохранения сессии' });
                res.json({ message: 'Авторизация успешна', redirect: '/editor' });
            });
        });
    } catch (err) {
        console.error('Ошибка авторизации:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ error: 'Ошибка сервера' });
        res.json({ message: 'Выход выполнен', redirect: '/auth' });
    });
});

app.get('/api/projects', requireAuth, (req, res) => {
    db.all('SELECT id, name, created_at FROM projects WHERE user_id = ?', [req.session.user.id], (err, projects) => {
        if (err) return res.status(500).json({ error: 'Ошибка сервера' });
        res.json(projects);
    });
});

app.post('/api/projects', requireAuth, (req, res) => {
    const { name, data } = req.body;
    if (!name || !data) return res.status(400).json({ error: 'Имя и данные обязательны' });
    db.run('INSERT INTO projects (user_id, name, data) VALUES (?, ?, ?)',
        [req.session.user.id, name, JSON.stringify(data)], function(err) {
            if (err) return res.status(500).json({ error: 'Ошибка сервера' });
            res.json({ message: 'Проект сохранён', id: this.lastID });
        });
});

app.delete('/api/projects/:id', requireAuth, (req, res) => {
    const projectId = req.params.id;
    db.run('DELETE FROM projects WHERE id = ? AND user_id = ?', [projectId, req.session.user.id], function(err) {
        if (err) return res.status(500).json({ error: 'Ошибка сервера' });
        if (this.changes === 0) return res.status(404).json({ error: 'Проект не найден или не принадлежит пользователю' });
        res.json({ message: 'Проект удалён' });
    });
});

app.get('/api/projects/:id', requireAuth, (req, res) => {
    const projectId = req.params.id;
    db.get('SELECT id, name, data, created_at FROM projects WHERE id = ?', [projectId], (err, project) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        if (!project) return res.status(404).json({ error: 'Project not found' });
        project.data = JSON.parse(project.data); // Парсим JSON данные
        res.json(project);
    });
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
    db.all('SELECT id, name, email, role, created_at, last_login FROM users', [], (err, users) => {
        if (err) return res.status(500).json({ error: 'Ошибка сервера' });
        res.json(users);
    });
});

app.put('/api/admin/users/:id/role', requireAdmin, (req, res) => {
    const userId = req.params.id;
    const { role } = req.body;
    if (userId == req.session.user.id) return res.status(400).json({ error: 'Нельзя изменить собственную роль' });
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Недопустимая роль' });
    db.run('UPDATE users SET role = ? WHERE id = ?', [role, userId], function(err) {
        if (err) return res.status(500).json({ error: 'Ошибка сервера' });
        if (this.changes === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json({ message: 'Роль обновлена' });
    });
});

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
    const userId = req.params.id;
    if (userId == req.session.user.id) return res.status(400).json({ error: 'Нельзя удалить самого себя' });
    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
        if (err) return res.status(500).json({ error: 'Ошибка сервера' });
        if (this.changes === 0) return res.status(404).json({ error: 'Пользователь не найден' });
        res.json({ message: 'Пользователь удалён' });
    });
});

app.get('/api/admin/projects', requireAdmin, (req, res) => {
    db.all('SELECT p.id, p.name, p.created_at, u.name as user_name FROM projects p JOIN users u ON p.user_id = u.id', [], (err, projects) => {
        if (err) return res.status(500).json({ error: 'Ошибка сервера' });
        res.json(projects);
    });
});

app.delete('/api/admin/projects/:id', requireAdmin, (req, res) => {
    const projectId = req.params.id;
    db.run('DELETE FROM projects WHERE id = ?', [projectId], function(err) {
        if (err) return res.status(500).json({ error: 'Ошибка сервера' });
        if (this.changes === 0) return res.status(404).json({ error: 'Проект не найден' });
        res.json({ message: 'Проект удалён' });
    });
});

app.post('/api/project-requests', requireAuth, (req, res) => {
    console.log('Получен запрос на /api/project-requests:', req.body);
    const { project_id } = req.body;
    if (!project_id) return res.status(400).json({ error: 'Project ID is required' });
    db.get('SELECT id FROM projects WHERE id = ? AND user_id = ?', [project_id, req.session.user.id], (err, project) => {
        if (err) {
            console.error('Ошибка проверки проекта:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        if (!project) return res.status(404).json({ error: 'Project not found or not owned by user' });
        db.run('INSERT INTO project_requests (user_id, project_id, status) VALUES (?, ?, ?)',
            [req.session.user.id, project_id, 'pending'], function(err) {
                if (err) {
                    console.error('Ошибка создания заявки:', err);
                    return res.status(500).json({ error: 'Server error' });
                }
                res.json({ message: 'Request submitted', id: this.lastID });
            });
    });
});

app.get('/api/project-requests', requireAuth, (req, res) => {
    db.all(`
        SELECT pr.id, pr.project_id, pr.status, pr.created_at, pr.updated_at, p.name as project_name 
        FROM project_requests pr 
        JOIN projects p ON pr.project_id = p.id 
        WHERE pr.user_id = ?
    `, [req.session.user.id], (err, requests) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json(requests);
    });
});

app.get('/api/admin/project-requests', requireAdmin, (req, res) => {
    db.all(`
        SELECT pr.id, pr.project_id, pr.status, pr.created_at, pr.updated_at, p.name as project_name, u.name as user_name 
        FROM project_requests pr 
        JOIN projects p ON pr.project_id = p.id 
        JOIN users u ON pr.user_id = u.id
    `, [], (err, requests) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        res.json(requests);
    });
});

app.put('/api/admin/project-requests/:id/approve', requireAdmin, (req, res) => {
    const requestId = req.params.id;
    db.run('UPDATE project_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
        ['approved', requestId], function(err) {
            if (err) return res.status(500).json({ error: 'Server error' });
            if (this.changes === 0) return res.status(404).json({ error: 'Request not found' });
            res.json({ message: 'Request approved' });
        });
});

app.put('/api/admin/project-requests/:id/reject', requireAdmin, (req, res) => {
    const requestId = req.params.id;
    db.run('UPDATE project_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
        ['rejected', requestId], function(err) {
            if (err) return res.status(500).json({ error: 'Server error' });
            if (this.changes === 0) return res.status(404).json({ error: 'Request not found' });
            res.json({ message: 'Request rejected' });
        });
});

app.post('/api/send-email-admin', requireAdmin, (req, res) => {
    const { to, subject, body } = req.body;
    if (!to || !subject || !body) return res.status(400).json({ error: 'All fields are required' });
    const mailOptions = {
        from: `"МакетБилд" <${process.env.EMAIL_PROVIDER === 'mailru' ? process.env.MAILRU_USER : process.env.EMAIL_USER}>`,
        to: to,
        subject: subject,
        text: body
    };
    transporter.sendMail(mailOptions, (err, info) => {
        if (err) return res.status(500).json({ error: 'Error sending email: ' + err.message });
        res.json({ message: 'Email sent successfully' });
    });
});

app.listen(PORT, () => {
    console.log(`МакетБилд server running on http://localhost:${PORT}`);
});