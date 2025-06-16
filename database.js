const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'database.db');

function initializeDatabase() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, err => {
            if (err) {
                console.error('Ошибка подключения к базе данных:', err.message);
                return reject(err);
            }
            console.log('Подключено к SQLite базе данных');

            db.serialize(() => {
                db.run(`
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        email TEXT UNIQUE NOT NULL,
                        password TEXT NOT NULL,
                        role TEXT DEFAULT 'user',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        last_login DATETIME
                    )
                `, err => { if (err) reject(err); });

                db.run(`
                    CREATE TABLE IF NOT EXISTS projects (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        name TEXT NOT NULL,
                        data TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id)
                    )
                `, err => { if (err) reject(err); });

                db.run(`
                    CREATE TABLE IF NOT EXISTS project_requests (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        project_id INTEGER NOT NULL,
                        status TEXT DEFAULT 'pending',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id),
                        FOREIGN KEY (project_id) REFERENCES projects(id)
                    )
                `, err => { if (err) reject(err); });

                db.get("SELECT id FROM users WHERE email = ?", ['admin@maketbuild.ru'], (err, row) => {
                    if (err) return reject(err);
                    if (!row) {
                        const testAdmin = {
                            name: 'Test Admin',
                            email: 'admin@maketbuild.ru',
                            password: 'admin123',
                            role: 'admin'
                        };
                        bcrypt.hash(testAdmin.password, 10, (err, hash) => {
                            if (err) return reject(err);
                            db.run(
                                'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                                [testAdmin.name, testAdmin.email, hash, testAdmin.role],
                                err => {
                                    if (err) return reject(err);
                                    console.log('Тестовый администратор создан:', testAdmin.email);
                                    resolve(db);
                                }
                            );
                        });
                    } else {
                        console.log('Администратор уже существует:', 'admin@maketbuild.ru');
                        resolve(db);
                    }
                });
            });
        });
    });
}

module.exports = { initializeDatabase };