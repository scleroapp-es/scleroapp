const CLIENT_ID = '899843305477-0b577o8vjdib46n8qcnf7ms6m2320g16.apps.googleusercontent.com';
const FOLDER_NAME = 'ScleroApp - Pruebas Médicas';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

function loadGisScript() {
  return new Promise((resolve) => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = resolve;
    document.head.appendChild(script);
  });
}

export function isDriveConnected() {
  const token = localStorage.getItem('sclero_drive_token');
  const expiry = localStorage.getItem('sclero_drive_expiry');
  if (!token || !expiry) return false;
  return Date.now() < parseInt(expiry);
}

export function clearDriveToken() {
  localStorage.removeItem('sclero_drive_token');
  localStorage.removeItem('sclero_drive_expiry');
}

export async function connectDrive() {
  await loadGisScript();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        localStorage.setItem('sclero_drive_token', response.access_token);
        localStorage.setItem('sclero_drive_expiry', String(Date.now() + (response.expires_in * 1000)));
        resolve(response.access_token);
      },
      error_callback: (err) => {
        reject(new Error(err.message || 'Error al conectar con Google'));
      }
    });
    client.requestAccessToken({ prompt: '' });
  });
}

async function driveRequest(url, options = {}) {
  const token = localStorage.getItem('sclero_drive_token');
  if (!token) throw new Error('No conectado a Google Drive. Ve a Configuración y conecta Drive.');

  const resp = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    }
  });

  if (resp.status === 401) {
    clearDriveToken();
    throw new Error('Sesión de Drive expirada. Ve a Configuración y vuelve a conectar Drive.');
  }

  if (resp.status === 204) return null;

  if (!resp.ok) {
    let errMsg = `Error ${resp.status}`;
    try {
      const errData = await resp.json();
      errMsg = errData.error?.message || errMsg;
    } catch (e) {}
    throw new Error('Error de Drive: ' + errMsg);
  }

  return resp;
}

async function getOrCreateFolder(name, parentId = null) {
  const parentQuery = parentId ? ` and '${parentId}' in parents` : '';
  const searchResp = await driveRequest(
    `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(name)}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentQuery}&fields=files(id,name)`
  );
  const searchData = await searchResp.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const body = { name, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) body.parents = [parentId];

  const createResp = await driveRequest('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const folder = await createResp.json();
  return folder.id;
}

export async function uploadPDFToDrive(fileName, arrayBuffer, subFolderName = null) {
  if (!isDriveConnected()) {
    try {
      await connectDrive();
    } catch (e) {
      throw new Error('Sesión de Drive expirada. Ve a Configuración y vuelve a conectar Drive.');
    }
  }

  // Get or create main folder
  const mainFolderId = await getOrCreateFolder(FOLDER_NAME);

  // Get or create subfolder if provided
  const targetFolderId = subFolderName
    ? await getOrCreateFolder(subFolderName, mainFolderId)
    : mainFolderId;

  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  const metadata = JSON.stringify({ name: fileName, parents: [targetFolderId] });
  const metaBlob = new Blob([metadata], { type: 'application/json' });
  const form = new FormData();
  form.append('metadata', metaBlob);
  form.append('file', blob);

  const uploadResp = await driveRequest(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    { method: 'POST', body: form }
  );

  const file = await uploadResp.json();
  return { id: file.id, name: file.name, url: file.webViewLink };
}

export function openDriveFile(fileId) {
  window.open(`https://drive.google.com/file/d/${fileId}/view`, '_blank');
}

export async function deleteDriveFile(fileId) {
  if (!isDriveConnected()) return;
  try {
    await driveRequest(`https://www.googleapis.com/drive/v3/files/${fileId}`, { method: 'DELETE' });
  } catch (e) {}
}
