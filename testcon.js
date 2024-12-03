const { google } = require('googleapis');

const credentials = require('./google-drive-credentials.json');
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});

async function testGoogleDrive() {
  try {
    const drive = google.drive({ version: 'v3', auth });
    const res = await drive.files.list({ pageSize: 5 });
    console.log('Archivos en Google Drive:', res.data.files);
  } catch (error) {
    console.error('Error con las credenciales:', error);
  }
}

testGoogleDrive();
