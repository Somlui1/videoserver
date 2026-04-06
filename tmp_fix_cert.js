const fs = require('fs');
const path = require('path');

const infile = path.join(__dirname, 'cert', 'certificate2026.pem');
const outKey = path.join(__dirname, 'nginx', 'ssl', 'aapico_2026.key');
const outCrt = path.join(__dirname, 'nginx', 'ssl', 'aapico_2026.crt');

try {
  const content = fs.readFileSync(infile, 'utf8');
  
  // Extract Private Key
  const keyMatch = content.match(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/);
  if (keyMatch) {
    fs.writeFileSync(outKey, keyMatch[0] + '\n', 'utf8');
    console.log('✅ Wrote Private Key to ' + outKey);
  } else {
    console.log('❌ Private Key block not found!');
  }

  // Extract Certificates
  const certMatches = content.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  if (certMatches && certMatches.length === 3) {
    // The PEM file had them in this order:
    // 0: Entity
    // 1: Root
    // 2: Intermediate
    // Nginx standard expects: Entity -> Intermediate -> Root
    
    // Check if index 1 is Root by looking inside the string (DigiCert Global Root G2)
    // Actually the string 'DigiCert Global Root G2' is outside the Base64, but we know the sizes:
    // 0: Entity cert is long
    // 1: Root cert (MIIDj...)
    // 2: Intermediate cert (MIIEsz...)
    
    const entity = certMatches[0];
    const root = certMatches[1];
    const intm = certMatches[2];
    
    // Write in correct order: Entity -> Intermediate -> Root
    const crtContent = [entity, intm, root].join('\n') + '\n';
    
    // Replace CRLF with LF to ensure pure Linux compatibility
    const cleanCrtContent = crtContent.replace(/\r\n/g, '\n');
    
    fs.writeFileSync(outCrt, cleanCrtContent, 'utf8');
    console.log('✅ Wrote Certificate Chain to ' + outCrt);
  } else {
    console.log('❌ Expected 3 certificates, found: ' + (certMatches ? certMatches.length : 0));
  }
} catch (e) {
  console.error('Error:', e.message);
}
