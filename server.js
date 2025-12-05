// Projeto completo em 1 arquivo (server.js)
// Para rodar: instale Node, crie uma pasta, coloque este arquivo como server.js
// Depois execute: npm init -y
// npm install express sqlite3 bcryptjs express-session ejs body-parser
// Por fim: node server.js

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const db = new sqlite3.Database('banco.db');

// Configurações
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'segredo', resave: false, saveUninitialized: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Cria tabelas se não existirem
db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT,
    usuario TEXT UNIQUE,
    senha TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS pacientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT,
	sexo TEXT,
    nascimento TEXT,
    status TEXT,
    observacao TEXT
)`);

// Middleware de autenticação
function auth(req, res, next) {
    if (!req.session.user) return res.redirect('/login');
    next();
}

// Rotas ----------------------------------------------------
app.get('/', (req, res) => res.redirect('/dashboard'));

app.get('/login', (req, res) => res.render('login'));
app.post('/login', (req, res) => {
    const { usuario, senha } = req.body;
    db.get("SELECT * FROM usuarios WHERE usuario = ?", [usuario], (err, user) => {
        if (!user) return res.send('Usuário não encontrado');
        if (!bcrypt.compareSync(senha, user.senha)) return res.send('Senha incorreta');
        req.session.user = user;
        res.redirect('/dashboard');
    });
});

// Criar 1º usuário manualmente
app.get('/criar-admin', (req, res) => {
    const senhaHash = bcrypt.hashSync('admin123', 10);
    db.run("INSERT INTO usuarios (nome, usuario, senha) VALUES (?,?,?)",
        ['Administrador', 'admin', senhaHash]);
    res.send('Admin criado: usuario=admin senha=admin123');
});

app.get('/dashboard', auth, (req, res) => {
    db.all("SELECT * FROM pacientes", (err, rows) => {
        res.render('dashboard', { user: req.session.user, pacientes: rows });
    });
});

app.get('/paciente/novo', auth, (req, res) => res.render('novo'));
app.post('/paciente/novo', auth, (req, res) => {
    const { nome, sexo, nascimento, observacao } = req.body;
    db.run("INSERT INTO pacientes (nome, sexo, nascimento, status, observacao) VALUES (?,?,?,?,?)",
        [nome, sexo, nascimento, 'Em acompanhamento', observacao]);
    res.redirect('/dashboard');
});

app.get('/paciente/:id/alta', auth, (req, res) => {
    db.run("UPDATE pacientes SET status='Alta' WHERE id=?", [req.params.id]);
    res.redirect('/dashboard');
});
// Página para editar paciente
app.get('/paciente/:id/editar', auth, (req, res) => {
    db.get("SELECT * FROM pacientes WHERE id = ?", [req.params.id], (err, paciente) => {
        if (!paciente) return res.send("Paciente não encontrado");
        res.render('editar', { paciente });
    });
});

// Salvar alterações do paciente
app.post('/paciente/:id/editar', auth, (req, res) => {
    const { nome, sexo, nascimento, observacao, status } = req.body;
    db.run(
        "UPDATE pacientes SET nome=?, sexo=?, nascimento=?, observacao=?, status=? WHERE id=?",
        [nome, sexo, nascimento, observacao, status, req.params.id],
        () => res.redirect('/dashboard')
    );
});
//-----------------------------------------------------------
app.listen(3000, "0.0.0.0", () => {
    console.log("Servidor rodando na porta 3000");
});

