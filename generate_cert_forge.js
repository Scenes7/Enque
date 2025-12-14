const forge = require('node-forge');
const fs = require('fs');

console.log("Generating certificates with node-forge...");

const pki = forge.pki;
const keys = pki.rsa.generateKeyPair(2048);
const cert = pki.createCertificate();

cert.publicKey = keys.publicKey;
cert.serialNumber = '01';
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

const attrs = [{
    name: 'commonName',
    value: 'localhost'
}, {
    name: 'countryName',
    value: 'US'
}, {
    shortName: 'ST',
    value: 'Virginia'
}, {
    name: 'localityName',
    value: 'Blacksburg'
}, {
    name: 'organizationName',
    value: 'Test'
}, {
    shortName: 'OU',
    value: 'Test'
}];

cert.setSubject(attrs);
cert.setIssuer(attrs);
cert.sign(keys.privateKey);

const pem = {
    private: pki.privateKeyToPem(keys.privateKey),
    cert: pki.certificateToPem(cert)
};

fs.writeFileSync('key.pem', pem.private);
fs.writeFileSync('cert.pem', pem.cert);

console.log("Certificates generated successfully.");
