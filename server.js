// -----------------------------
// CONFIGURAÇÃO DO PROJETO
// -----------------------------

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const db = new sqlite3.Database('banco.db');

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'segredo',
    resave: false,
    saveUninitialized: false
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


// -----------------------------
// BANCO DE DADOS
// -----------------------------

db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT,
    usuario TEXT UNIQUE,
    senha TEXT,
    tipo TEXT DEFAULT 'funcionario'
)`);

db.run(`CREATE TABLE IF NOT EXISTS pacientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT,
    sexo TEXT,
    nascimento TEXT,
    status TEXT,
    observacao TEXT
)`);


// -----------------------------
// MIDDLEWARES
// -----------------------------

app.get('/criar-admin', (req, res) => {
    const senhaHash = bcrypt.hashSync('admin123', 10);
    db.run("INSERT INTO usuarios (nome, usuario, senha, tipo) VALUES (?,?,?,?)",
        ['Administrador', 'admin', senhaHash, 'admin']);
    res.send('Admin criado: usuario=admin senha=admin123');
});

app.get('/criar-usuario', authAdmin, (req, res) => {
    res.render('user');
});

// Verifica login
function auth(req, res, next) {
    if (!req.session.user) return res.redirect('/login');
    next();
}

// Permitir apenas admin
function authAdmin(req, res, next) {
    if (!req.session.user)
        return res.status(401).send("Você precisa fazer login.");

    if (req.session.user.tipo !== 'admin')
        return res.status(403).send("Acesso negado – somente admin.");

    next();
}


// -----------------------------
// ROTAS DE AUTENTICAÇÃO
// -----------------------------

app.get('/', (req, res) => res.redirect('/dashboard'));

app.get('/login', (req, res) => res.render('login'));

app.post('/login', (req, res) => {
    const { usuario, senha } = req.body;

    db.get("SELECT * FROM usuarios WHERE usuario = ?", [usuario], (err, user) => {
        if (!user) return res.send('Usuário não encontrado');
        if (!bcrypt.compareSync(senha, user.senha)) return res.send('Senha incorreta');

        req.session.user = user; // salva tudo, inclusive tipo
        res.redirect('/dashboard');
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});


// -----------------------------
// ROTAS DE ADMINISTRADOR
// -----------------------------

// Criar primeiro admin manualmente
app.get('/criar-admin', (req, res) => {
    const senhaHash = bcrypt.hashSync('admin123', 10);

    db.run(
        "INSERT INTO usuarios (nome, usuario, senha, tipo) VALUES (?,?,?,?)",
        ['Administrador', 'admin', senhaHash, 'admin'],
        err => {
            if (err) return res.send("Erro: " + err.message);
            res.send('Admin criado: usuario=admin senha=admin123');
        }
    );
});

// Página para criar usuário
app.get('/novo-usuario', authAdmin, (req, res) => {
    res.render('user'); // user.ejs
});

// Criar usuário (funcionário)
app.post('/criar-usuario', authAdmin, (req, res) => {
    const { nome, usuario, senha } = req.body;

    const senhaHash = bcrypt.hashSync(senha, 10);

    db.run(
        "INSERT INTO usuarios (nome, usuario, senha, tipo) VALUES (?,?,?,?)",
        [nome, usuario, senhaHash, 'funcionario'],
        err => {
            if (err) return res.send("Erro ao criar usuário: " + err.message);
            res.send("Usuário criado com sucesso!");
        }
    );
});


// -----------------------------
// ROTAS DO SISTEMA (PACIENTES)
// -----------------------------

app.get('/dashboard', auth, (req, res) => {
    db.all("SELECT * FROM pacientes", (err, pacientes) => {
        res.render('dashboard', { user: req.session.user, pacientes });
    });
});

app.get('/paciente/novo', auth, (req, res) => {
    res.render('novo');
});

app.post('/paciente/novo', auth, (req, res) => {
    const { nome, sexo, nascimento, observacao } = req.body;

    db.run(
        "INSERT INTO pacientes (nome, sexo, nascimento, status, observacao) VALUES (?,?,?,?,?)",
        [nome, sexo, nascimento, 'Em acompanhamento', observacao],
        () => res.redirect('/dashboard')
    );
});

app.get('/paciente/:id/alta', auth, (req, res) => {
    db.run("UPDATE pacientes SET status='Alta' WHERE id=?", [req.params.id]);
    res.redirect('/dashboard');
});

app.get('/paciente/:id/editar', auth, (req, res) => {
    db.get("SELECT * FROM pacientes WHERE id = ?", [req.params.id], (err, paciente) => {
        if (!paciente) return res.send("Paciente não encontrado");
        res.render('editar', { paciente });
    });
});

app.post('/paciente/:id/editar', auth, (req, res) => {
    const { nome, sexo, nascimento, observacao, status } = req.body;

    db.run(
        `UPDATE pacientes 
         SET nome=?, sexo=?, nascimento=?, observacao=?, status=?
         WHERE id=?`,
        [nome, sexo, nascimento, observacao, status, req.params.id],
        () => res.redirect('/dashboard')
    );
});


// -----------------------------
// INICIAR SERVIDOR (Render)
// -----------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log("Servidor rodando na porta " + PORT);
});
