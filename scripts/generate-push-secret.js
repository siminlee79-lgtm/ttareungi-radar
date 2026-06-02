const crypto = require("crypto");

const secret = crypto.randomBytes(32).toString("base64url");

console.log(secret);
