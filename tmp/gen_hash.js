const bcrypt = require('bcrypt');
const saltRounds = 10;
const password = 'admin1234';
const hash = bcrypt.hashSync(password, saltRounds);
console.log(hash);
