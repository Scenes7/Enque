const selfsigned = require('selfsigned');
const fs = require('fs');

console.log("Generating certificates...");
try {
    const attrs = [{ name: 'commonName', value: 'localhost' }];
    const pems = selfsigned.generate(attrs, { days: 365 });

    fs.writeFileSync('key.pem', pems.private);
    fs.writeFileSync('cert.pem', pems.cert);
    console.log("Certificates generated successfully.");
} catch (e) {
    console.error("Error generating certificates:", e);
}
